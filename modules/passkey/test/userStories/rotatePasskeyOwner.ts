// Import necessary dependencies from chai, hardhat, @safe-global, webauthn
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

/**
 * User story: Rotate passkey owner
 * The test case here deploys a Safe with an EOA and a passkey signer as owners with threshold 1.
 * The EOA then executes a userOp to swap the passkey signer with a new passkey signer.
 *
 * The flow can be summarized as follows:
 * Step 1: Setup the contracts
 * Step 2: Create a userOp, sign it with EOA wallet
 * Step 3: Execute the userOp that deploys a safe with EOA and passkey signer as owners
 * Step 4: Create a userOp to swap the passkey signer, sign it with EOA wallet
 * Step 5: Execute the userOp to swap the passkey signer
 */
describe('Rotate passkey owner [@User story]', () => {
  // Create a fixture to setup the contracts and signer(s)
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { EntryPoint, Safe4337Module, SafeProxyFactory, SafeModuleSetup, SafeL2, FCLP256Verifier } = await deployments.run()

    // EOA which will be the owner of the Safe
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

    // Create a WebAuthn credential for the initial signer
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
    await (await signerFactory.createSigner(publicKey.x, publicKey.y, verifier.target)).wait()
    const signer = await signerFactory.getSigner(publicKey.x, publicKey.y, verifier.target)

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

  it('should execute a userOp with replaced WebAuthn signer as Safe owner', async () => {
    // Step 1: Setup the contracts
    const { user, proxyFactory, safeModuleSetup, module, entryPoint, verifier, singleton, navigator, SafeL2, signer, signerFactory } =
      await setupTests()

    // Step 2: Create a userOp, sign it with EOA wallet

    // The initializer data to enable the Safe4337Module as a module on a Safe
    const initializer = safeModuleSetup.interface.encodeFunctionData('enableModules', [[module.target]])

    // Create setup data to deploy a Safe with EOA and passkey signer as owners, threshold 1, Safe4337Module as module and fallback handler
    const setupData = singleton.interface.encodeFunctionData('setup', [
      [user.address, signer],
      1n,
      safeModuleSetup.target,
      initializer,
      module.target,
      ethers.ZeroAddress,
      0,
      ethers.ZeroAddress,
    ])

    // Predict the Safe address to construct the userOp, generate
    const safeSalt = Date.now()
    const safe = await proxyFactory.createProxyWithNonce.staticCall(singleton, setupData, safeSalt)

    // Deploy data required in the initCode of the userOp
    const deployData = proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [singleton.target, setupData, safeSalt])

    const safeOp = buildSafeUserOpTransaction(
      safe,
      ethers.ZeroAddress,
      0n,
      '0x',
      await entryPoint.getNonce(safe, 0),
      await entryPoint.getAddress(),
      false,
      true,
      {
        initCode: ethers.solidityPacked(['address', 'bytes'], [proxyFactory.target, deployData]),
      },
    )

    const packedUserOp = buildPackedUserOperationFromSafeUserOperation({
      safeOp,
      signature: '0x',
    })

    // Build the signature that a Safe can decode and verify
    const signature = buildSignatureBytes([
      {
        signer: signer as string,
        data: buildSignatureBytes([await signSafeOp(user, await module.getAddress(), safeOp, await chainId())]),
      },
    ])

    // Send 1 ETH to the Safe
    await user.sendTransaction({ to: safe, value: ethers.parseEther('1') }).then((tx) => tx.wait())
    // Check if Safe is not already created
    expect(await ethers.provider.getCode(safe)).to.equal('0x')

    // Step 3: Execute the userOp that deploys a safe with EOA and passkey signer as owners
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

    // Check if Safe is created and uses the expected Singleton
    const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
    expect(implementation).to.equal(singleton.target)

    // Check the owners of the created Safe
    const safeInstance = await ethers.getContractAt(SafeL2.abi, safe)
    expect(await safeInstance.getOwners()).to.deep.equal([user.address, signer])

    // Step 4: Create a userOp to swap the passkey signer, sign it with EOA wallet

    // Create a new WebAuthn credential for the new signer
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
    await (await signerFactory.createSigner(publicKeyNew.x, publicKeyNew.y, verifier.target)).wait()
    const signerNew = await signerFactory.getSigner(publicKeyNew.x, publicKeyNew.y, verifier.target)

    const interfaceSwapOwner = new ethers.Interface(['function swapOwner(address,address,address)'])
    const data = interfaceSwapOwner.encodeFunctionData('swapOwner', [user.address, signer, signerNew])

    // Build SafeOp
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

    // EOA wallet signs the userOp to swap the Passkey signer
    const signatureSwapSigner = buildSignatureBytes([
      {
        signer: signer as string,
        data: buildSignatureBytes([await signSafeOp(user, await module.getAddress(), safeOpSwapSigner, await chainId())]),
      },
    ])

    // Step 5: Execute the userOp to swap the passkey signer
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

    // Check if new signer is a Safe owner
    expect(await safeInstance.getOwners()).to.deep.equal([user.address, signerNew])
  })
})
