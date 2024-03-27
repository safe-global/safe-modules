import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { WebAuthnCredentials, decodePublicKey } from '../utils/webauthn'
import { Safe4337Module } from '@safe-global/safe-4337/typechain-types/contracts/Safe4337Module'
import {
  buildSafeUserOpTransaction,
  buildPackedUserOperationFromSafeUserOperation,
  signSafeOp,
} from '@safe-global/safe-4337/src/utils/userOp'
import { buildSignatureBytes } from '@safe-global/safe-4337/src/utils/execution'
import { chainId } from '@safe-global/safe-4337/test/utils/encoding'

describe('Rotate passkey owner [@User story]', () => {
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
    const {
      user,
      proxyFactory,
      safeModuleSetup,
      module,
      entryPoint,
      verifier,
      singleton,
      navigator,
      SafeL2,
      signer,
      signerFactory,
      credential,
    } = await setupTests()

    const safeSalt = 1n
    const initializer = safeModuleSetup.interface.encodeFunctionData('enableModules', [[module.target]])

    // Deploy a Safe with EOA and passkey signer as owners
    const setupData = singleton.interface.encodeFunctionData('setup', [
      [user.address, signer],
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

    const signature = buildSignatureBytes([
      {
        signer: signer as string,
        data: buildSignatureBytes([await signSafeOp(user, await module.getAddress(), safeOp, await chainId())]),
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

    expect(await ethers.provider.getBalance(safe)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    expect(await ethers.provider.getCode(safe)).to.not.equal('0x')

    const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
    expect(implementation).to.equal(singleton.target)

    const safeInstance = await ethers.getContractAt(SafeL2.abi, safe)
    expect(await safeInstance.getOwners()).to.deep.equal([user.address, signer])

    // Swap the signer
    const credentialNew = navigator.credentials.create({
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

    const publicKeyNew = decodePublicKey(credentialNew.response)
    await (await signerFactory.createSigner(publicKeyNew.x, publicKeyNew.y, await verifier.getAddress())).wait()
    const signerNew = await signerFactory.getSigner(publicKeyNew.x, publicKeyNew.y, await verifier.getAddress())

    const interfaceSwapOwner = new ethers.Interface(['function swapOwner(address,address,address)'])

    const data = interfaceSwapOwner.encodeFunctionData('swapOwner', [user.address, signer, signerNew])

    const safeOpSwapSigner = buildSafeUserOpTransaction(
      safe,
      safe,
      0,
      data,
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

    const packedUserOpSwapSigner = buildPackedUserOperationFromSafeUserOperation({
      safeOp: safeOpSwapSigner,
      signature: '0x',
    })

    const signatureSwapSigner = buildSignatureBytes([
      {
        signer: signer as string,
        data: buildSignatureBytes([await signSafeOp(user, await module.getAddress(), safeOpSwapSigner, await chainId())]),
      },
    ])

    // Prepend the signature with 0x000000000000000000000000 to indicate validUntil and validAfter fields
    await (
      await entryPoint.handleOps(
        [
          {
            ...packedUserOpSwapSigner,
            signature: ethers.solidityPacked(
              ['uint48', 'uint48', 'bytes'],
              [safeOpSwapSigner.validAfter, safeOpSwapSigner.validUntil, signatureSwapSigner],
            ),
          },
        ],
        user.address,
      )
    ).wait()

    expect(await safeInstance.getOwners()).to.deep.equal([user.address, signerNew])
  })
})
