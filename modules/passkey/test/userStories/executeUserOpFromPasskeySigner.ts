import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { WebAuthnCredentials, decodePublicKey, encodeWebAuthnSignature } from '../utils/webauthn'
import { Safe4337Module } from '@safe-global/safe-4337/typechain-types/contracts/Safe4337Module'
import { buildSafeUserOpTransaction, buildPackedUserOperationFromSafeUserOperation } from '@safe-global/safe-4337/src/utils/userOp'
import { buildSignatureBytes } from '@safe-global/safe-4337/src/utils/execution'

describe('Execute UserOp from Passkey signer [@User story]', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { EntryPoint, Safe4337Module, SafeProxyFactory, SafeModuleSetup, SafeL2, FCLP256Verifier } = await deployments.run()

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
    }
  })

  it('should execute a userOp with WebAuthn signer as owner', async () => {
    const { user, proxyFactory, safeModuleSetup, module, entryPoint, singleton, navigator, SafeL2, signer, credential } = await setupTests()

    const safeSalt = 1n
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

    const deployData = proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [singleton.target, setupData, safeSalt])
    const initCode = ethers.solidityPacked(['address', 'bytes'], [proxyFactory.target, deployData])

    const safeOp = buildSafeUserOpTransaction(
      safe,
      user.address,
      ethers.parseEther('0.0'),
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
        signer: signer as string,
        data: encodeWebAuthnSignature(assertion.response),
        dynamic: true,
      },
    ])

    expect(await ethers.provider.getCode(entryPoint)).to.not.equal('0x')

    await user.sendTransaction({ to: safe, value: ethers.parseEther('1') }).then((tx) => tx.wait())
    expect(await ethers.provider.getBalance(safe)).to.equal(ethers.parseEther('1'))
    expect(await ethers.provider.getCode(safe)).to.equal('0x')

    await (
      await entryPoint.handleOps(
        [
          {
            ...packedUserOp,
            signature: ethers.solidityPacked(['uint48', 'uint48', 'bytes'], [safeOp.validAfter, safeOp.validUntil, signature]),
          },
        ],
        user.address,
      )
    ).wait()

    expect(await ethers.provider.getCode(safe)).to.not.equal('0x')

    const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
    expect(implementation).to.equal(singleton.target)

    const safeInstance = await ethers.getContractAt(SafeL2.abi, safe)
    expect(await safeInstance.getOwners()).to.deep.equal([signer])

    // Execute the userOp from passkey signer
    const safeOp2 = buildSafeUserOpTransaction(
      safe,
      ethers.ZeroAddress,
      ethers.parseEther('0.2'),
      '0x',
      await entryPoint.getNonce(safe, 0),
      await entryPoint.getAddress(),
      false,
      true,
      {
        verificationGasLimit: 700000,
        callGasLimit: 2000000,
        maxFeePerGas: 10000000000,
        maxPriorityFeePerGas: 10000000000,
      },
    )

    const packedUserOp2 = buildPackedUserOperationFromSafeUserOperation({
      safeOp: safeOp2,
      signature: '0x',
    })

    const opHash2 = await module.getOperationHash(packedUserOp2)

    const assertion2 = navigator.credentials.get({
      publicKey: {
        challenge: ethers.getBytes(opHash2),
        rpId: 'safe.global',
        allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
        userVerification: 'required',
      },
    })

    const signature2 = buildSignatureBytes([
      {
        signer: signer as string,
        data: encodeWebAuthnSignature(assertion2.response),
        dynamic: true,
      },
    ])

    const balanceBefore = await ethers.provider.getBalance(ethers.ZeroAddress)

    await (
      await entryPoint.handleOps(
        [
          {
            ...packedUserOp2,
            signature: ethers.solidityPacked(['uint48', 'uint48', 'bytes'], [safeOp2.validAfter, safeOp2.validUntil, signature2]),
          },
        ],
        user.address,
      )
    ).wait()

    expect(await ethers.provider.getBalance(ethers.ZeroAddress)).to.be.equal(balanceBefore + ethers.parseEther('0.2'))
  })
})
