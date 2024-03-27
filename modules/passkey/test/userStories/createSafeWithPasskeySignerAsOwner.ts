import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { WebAuthnCredentials, decodePublicKey, encodeWebAuthnSignature } from '../utils/webauthn'
import { Safe4337Module } from '@safe-global/safe-4337/typechain-types/contracts/Safe4337Module'
import { buildSafeUserOpTransaction, buildPackedUserOperationFromSafeUserOperation } from '@safe-global/safe-4337/src/utils/userOp'
import { buildSignatureBytes } from '@safe-global/safe-4337/src/utils/execution'

describe.only('User story', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { EntryPoint, Safe4337Module, SafeProxyFactory, SafeModuleSetup, SafeL2, FCLP256Verifier } = await deployments.run()
    console.log('entrypoint address', EntryPoint.address)

    const [user] = await ethers.getSigners()

    const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
    const module = (await ethers.getContractAt(Safe4337Module.abi, Safe4337Module.address)) as unknown as Safe4337Module
    const proxyFactory = await ethers.getContractAt(SafeProxyFactory.abi, SafeProxyFactory.address)
    const safeModuleSetup = await ethers.getContractAt(SafeModuleSetup.abi, SafeModuleSetup.address)
    const singleton = await ethers.getContractAt(SafeL2.abi, SafeL2.address)
    const verifier = await ethers.getContractAt('IP256Verifier', FCLP256Verifier.address)

    const WebAuthnSignerFactory = await ethers.getContractFactory('WebAuthnSignerFactory')
    const signerFactory = await WebAuthnSignerFactory.deploy()

    const navigator = {
      credentials: new WebAuthnCredentials(),
    }

    const credential = navigator.credentials.create({
      publicKey: {
        rp: {
          name: 'Safe',
          id: 'safe.global',
        },
        user: {
          id: ethers.getBytes(ethers.id('chucknorris')),
          name: 'chucknorris',
          displayName: 'Chuck Norris',
        },
        challenge: ethers.toBeArray(Date.now()),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      },
    })

    const publicKey = decodePublicKey(credential.response)
    await (await signerFactory.createSigner(publicKey.x, publicKey.y, await verifier.getAddress())).wait()
    const signer = await signerFactory.getSigner(publicKey.x, publicKey.y, await verifier.getAddress())

    const TestStakedFactory = await ethers.getContractFactory('TestStakedFactory')
    const stakedFactory = await TestStakedFactory.deploy(proxyFactory.target)
    const stake = ethers.parseEther('1.0')
    await stakedFactory
      .stakeEntryPoint(await entryPoint.getAddress(), 0xffffffffn, {
        value: stake,
      })
      .then((tx) => tx.wait())

    return {
      user,
      proxyFactory,
      safeModuleSetup,
      module,
      entryPoint,
      singleton,
      signerFactory,
      navigator,
      verifier,
      SafeL2,
      signer,
      credential,
      stakedFactory,
    }
  })

  it('should execute a user op and deploy a WebAuthn signer', async () => {
    const { user, proxyFactory, stakedFactory, safeModuleSetup, module, entryPoint, singleton, navigator, SafeL2, signer, credential } =
      await setupTests()

    const safeSalt = Date.now()
    const initializer = safeModuleSetup.interface.encodeFunctionData('enableModules', [[module.target]])

    const setupData = singleton.interface.encodeFunctionData('setup', [
      [signer],
      1n,
      await safeModuleSetup.getAddress(),
      initializer,
      await module.getAddress(),
      ethers.ZeroAddress,
      0,
      ethers.ZeroAddress,
    ])

    const safe = await proxyFactory.createProxyWithNonce.staticCall(singleton, setupData, safeSalt)

    const deployData = proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [singleton.target, initializer, safeSalt])
    const initCode = ethers.solidityPacked(['address', 'bytes'], [stakedFactory.target, deployData])

    const safeOp = buildSafeUserOpTransaction(
      safe,
      user.address,
      ethers.parseEther('0.5'),
      '0x',
      await entryPoint.getNonce(safe, 0),
      await entryPoint.getAddress(),
      false,
      true,
      {
        initCode,
        verificationGasLimit: 700000,
        callGasLimit: 2000000,
        maxFeePerGas: 10000000000,
        maxPriorityFeePerGas: 10000000000,
      },
    )

    const packedUserOp = buildPackedUserOperationFromSafeUserOperation({
      safeOp,
      signature: '0x',
    })

    const opHash = await module.getOperationHash(packedUserOp)

    const assertion = navigator.credentials.get({
      publicKey: {
        challenge: ethers.getBytes(opHash),
        rpId: 'safe.global',
        allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
        userVerification: 'required',
      },
    })

    const signature = buildSignatureBytes([
      {
        signer: signer,
        data: encodeWebAuthnSignature(assertion.response),
        dynamic: true,
      },
    ])

    expect(await ethers.provider.getCode(entryPoint)).to.not.equal('0x')

    await user.sendTransaction({ to: safe, value: ethers.parseEther('1') }).then((tx) => tx.wait())
    expect(await ethers.provider.getBalance(safe)).to.equal(ethers.parseEther('1'))
    expect(await ethers.provider.getCode(safe)).to.equal('0x')

    await (await entryPoint.handleOps([{ ...packedUserOp, signature }], user.address)).wait()
    expect(await ethers.provider.getBalance(safe)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    expect(await ethers.provider.getCode(safe)).to.not.equal('0x')

    const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
    expect(implementation).to.equal(singleton.target)

    const safeInstance = await ethers.getContractAt(SafeL2.abi, safe)
    expect(await safeInstance.getOwners()).to.deep.equal([signer])
  })
})
