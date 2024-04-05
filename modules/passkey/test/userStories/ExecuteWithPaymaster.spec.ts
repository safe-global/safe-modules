import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { WebAuthnCredentials, decodePublicKey, encodeWebAuthnSignature } from '../utils/webauthn'
import { buildSafeUserOpTransaction, buildPackedUserOperationFromSafeUserOperation } from '@safe-global/safe-4337/src/utils/userOp'
import { buildSignatureBytes } from '@safe-global/safe-4337/src/utils/execution'
import { VerifyingPaymaster } from '../../typechain-types'

/**
 * User story: Execute transaction with Paymaster
 * 1. The test case deploys a Safe with a passkey signer as an Owner. The transaction is sponsored by a Paymaster.
 * 2. The test case executes a userOp with an existing Safe using a Paymaster.
 *
 * The paymaster is VerifyingPaymaster contract imported from @account-abstraction/contracts/samples/VerifyingPaymaster.sol.
 * This contract has a verifyingSigner address which provides approval for sponsoring userOp gas via ECDSA signatures.
 *
 */
describe('Execute userOps with Paymaster: [@userstory]', () => {
  /**
   * The flow can be summarized as follows:
   * Step 1: Setup the contracts.
   * Step 2: Create a userOp with initCode that would deploy a Safe account.
   * Step 3: Get signature from verifyingSigner account and create paymaster data.
   * Step 4: Sign userOp with Passkey signer.
   * Step 5: Execute the userOp that deploys a Safe with passkey signer as owner using Paymaster.
   */
  describe('Execute a userOp that deploys a Safe using Paymaster', () => {
    // Create a fixture to setup the contracts and signer(s)
    const setupTests = deployments.createFixture(async ({ deployments }) => {
      const { EntryPoint, Safe4337Module, SafeProxyFactory, SafeModuleSetup, SafeL2, FCLP256Verifier, WebAuthnSignerFactory } =
        await deployments.run()

      const [relayer, verifyingSigner] = await ethers.getSigners()

      const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
      const module = await ethers.getContractAt(Safe4337Module.abi, Safe4337Module.address)
      const proxyFactory = await ethers.getContractAt(SafeProxyFactory.abi, SafeProxyFactory.address)
      const safeModuleSetup = await ethers.getContractAt(SafeModuleSetup.abi, SafeModuleSetup.address)
      const singleton = await ethers.getContractAt(SafeL2.abi, SafeL2.address)
      const verifier = await ethers.getContractAt('IP256Verifier', FCLP256Verifier.address)
      const signerFactory = await ethers.getContractAt('WebAuthnSignerFactory', WebAuthnSignerFactory.address)

      // Deploy a Paymaster contract

      const paymaster = (await (
        await ethers.getContractFactory('VerifyingPaymaster')
      ).deploy(entryPoint, verifyingSigner)) as unknown as VerifyingPaymaster

      // Add paymaster deposit
      await paymaster.deposit({ value: ethers.parseEther('10') })

      const navigator = {
        credentials: new WebAuthnCredentials(),
      }

      // Create a WebAuthn credential for the signer
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

      return {
        relayer,
        proxyFactory,
        safeModuleSetup,
        module,
        entryPoint,
        singleton,
        signerFactory,
        navigator,
        verifier,
        SafeL2,
        credential,
        paymaster,
        verifyingSigner,
      }
    })

    it('should execute a userOp and deploy a Safe using Paymaster', async () => {
      const {
        relayer,
        proxyFactory,
        safeModuleSetup,
        module,
        entryPoint,
        singleton,
        navigator,
        SafeL2,
        credential,
        signerFactory,
        verifier,
        paymaster,
        verifyingSigner,
      } = await setupTests()

      // Deploy a signer contract
      const publicKey = decodePublicKey(credential.response)
      // Deploy signer contract
      await signerFactory.createSigner(publicKey.x, publicKey.y, await verifier.getAddress())
      // Get signer address
      const signer = await signerFactory.getSigner(publicKey.x, publicKey.y, await verifier.getAddress())

      // Step 2: Create a userOp with initCode that would deploy a Safe account.

      // The initializer data to enable the Safe4337Module as a module on a Safe
      const initializer = safeModuleSetup.interface.encodeFunctionData('enableModules', [[module.target]])

      // Create setup data to deploy a Safe with EOA and passkey signer as owners, threshold 1, Safe4337Module as module and fallback handler
      const setupData = singleton.interface.encodeFunctionData('setup', [
        [signer],
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

      // Step 3: Get signature from verifyingSigner account and create paymaster data.
      const paymasterVerificationGasLimit = 60000
      const paymasterPostOpGasLimit = 60000
      let paymasterAndData = ethers.solidityPacked(
        ['address', 'uint128', 'uint128'],
        [paymaster.target, paymasterVerificationGasLimit, paymasterPostOpGasLimit],
      )

      const safeOp = buildSafeUserOpTransaction(
        safe,
        ethers.ZeroAddress,
        0,
        '0x',
        await entryPoint.getNonce(safe, 0),
        await entryPoint.getAddress(),
        false,
        true,
        {
          initCode: ethers.solidityPacked(['address', 'bytes'], [proxyFactory.target, deployData]),
          // Set a higher verificationGasLimit to avoid error "AA26 over verificationGasLimit"
          verificationGasLimit: 600000,
          paymasterAndData: paymasterAndData,
        },
      )

      const packedUserOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature: '0x',
      })

      const paymasterValidUntil = 0
      const paymasterValidAfter = 0
      const paymasterHash = await paymaster.getHash(packedUserOp, paymasterValidAfter, paymasterValidUntil)
      const paymasterSignature = await verifyingSigner.signMessage(ethers.getBytes(paymasterHash))
      const paymasterData = ethers.solidityPacked(
        ['bytes', 'bytes'],
        [ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [paymasterValidAfter, paymasterValidUntil]), paymasterSignature],
      )

      paymasterAndData = ethers.solidityPacked(
        ['address', 'uint128', 'uint128', 'bytes'],
        [paymaster.target, paymasterVerificationGasLimit, paymasterPostOpGasLimit, paymasterData],
      )

      packedUserOp.paymasterAndData = paymasterAndData

      // Step 4: Sign userOp with Passkey signer.
      // opHash that will be signed using Passkey credentials
      const opHash = await module.getOperationHash(packedUserOp)

      const assertion = navigator.credentials.get({
        publicKey: {
          challenge: ethers.getBytes(opHash),
          rpId: 'safe.global',
          allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
          userVerification: 'required',
        },
      })

      // Build the contract signature that a Safe will forward to the signer contract
      const signature = buildSignatureBytes([
        {
          signer: signer,
          data: encodeWebAuthnSignature(assertion.response),
          dynamic: true,
        },
      ])

      // Set the signature in the packedUserOp
      packedUserOp.signature = ethers.solidityPacked(['uint48', 'uint48', 'bytes'], [safeOp.validAfter, safeOp.validUntil, signature])

      // Check if Safe is not already created
      expect(await ethers.provider.getCode(safe)).to.equal('0x')

      // Step 5: Execute the userOp that deploys a Safe with passkey signer as owner using Paymaster.
      await entryPoint.handleOps([packedUserOp], relayer.address)

      // Check if Safe is created and uses the expected Singleton
      const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
      expect(implementation).to.equal(singleton.target)

      // Check if signer is the Safe owner
      const safeInstance = await ethers.getContractAt(SafeL2.abi, safe)
      expect(await safeInstance.getOwners()).to.deep.equal([signer])
    })
  })

  /**
   * The flow can be summarized as follows:
   * Step 1: Setup the contracts.
   * Step 2: Create a userOp with callData that transfer 0.2 ethers to address(0).
   * Step 3: Get signature from verifyingSigner account and create paymaster data.
   * Step 4: Sign userOp with Passkey signer.
   * Step 5: Execute the userOp that with an existing Safe with passkey signer as owner using Paymaster.
   */
  describe('Execute a userOp with an existing Safe using Paymaster', () => {
    // Create a fixture to setup the contracts and signer(s)
    const setupTests = deployments.createFixture(async ({ deployments }) => {
      const { EntryPoint, Safe4337Module, SafeProxyFactory, SafeModuleSetup, SafeL2, FCLP256Verifier, WebAuthnSignerFactory } =
        await deployments.run()

      const [relayer, verifyingSigner] = await ethers.getSigners()

      const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
      const module = await ethers.getContractAt(Safe4337Module.abi, Safe4337Module.address)
      const proxyFactory = await ethers.getContractAt(SafeProxyFactory.abi, SafeProxyFactory.address)
      const safeModuleSetup = await ethers.getContractAt(SafeModuleSetup.abi, SafeModuleSetup.address)
      const singleton = await ethers.getContractAt(SafeL2.abi, SafeL2.address)
      const verifier = await ethers.getContractAt('IP256Verifier', FCLP256Verifier.address)
      const signerFactory = await ethers.getContractAt('WebAuthnSignerFactory', WebAuthnSignerFactory.address)

      // Deploy a Paymaster contract
      const paymaster = (await (
        await ethers.getContractFactory('VerifyingPaymaster')
      ).deploy(entryPoint, verifyingSigner)) as unknown as VerifyingPaymaster
      // Add deposit
      await paymaster.deposit({ value: ethers.parseEther('10') })

      // await user.sendTransaction({ to: safe, value: ethers.parseEther('1') })

      const navigator = {
        credentials: new WebAuthnCredentials(),
      }

      // Create a WebAuthn credential for the signer
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
      await signerFactory.createSigner(publicKey.x, publicKey.y, verifier.target)
      const signer = await signerFactory.getSigner(publicKey.x, publicKey.y, verifier.target)

      // The initializer data to enable the Safe4337Module as a module on a Safe
      const initializer = safeModuleSetup.interface.encodeFunctionData('enableModules', [[module.target]])

      // Create setup data to deploy a Safe with EOA and passkey signer as owners, threshold 1, Safe4337Module as module and fallback handler
      const setupData = singleton.interface.encodeFunctionData('setup', [
        [signer],
        1n,
        safeModuleSetup.target,
        initializer,
        module.target,
        ethers.ZeroAddress,
        0,
        ethers.ZeroAddress,
      ])

      // Deploy a Safe with EOA and passkey signer as owners
      const safeSalt = Date.now()
      const safeAddress = await proxyFactory.createProxyWithNonce.staticCall(singleton, setupData, safeSalt)
      await proxyFactory.createProxyWithNonce(singleton, setupData, safeSalt)

      return {
        relayer,
        module,
        entryPoint,
        navigator,
        credential,
        paymaster,
        safeAddress,
        signer,
        verifyingSigner,
      }
    })

    it('should execute a userOp with an existing Safe using Paymaster', async () => {
      const { safeAddress, signer, relayer, module, entryPoint, navigator, credential, paymaster, verifyingSigner } = await setupTests()

      const paymasterVerificationGasLimit = 60000
      const paymasterPostOpGasLimit = 60000
      let paymasterAndData = ethers.solidityPacked(
        ['address', 'uint128', 'uint128'],
        [paymaster.target, paymasterVerificationGasLimit, paymasterPostOpGasLimit],
      )

      // Step 2: Create a userOp with callData that transfer 0.2 ethers to address(0).
      const safeOp = buildSafeUserOpTransaction(
        safeAddress,
        ethers.ZeroAddress,
        ethers.parseEther('0.2'),
        '0x',
        await entryPoint.getNonce(safeAddress, 0),
        await entryPoint.getAddress(),
        false,
        true,
        {
          paymasterAndData: paymasterAndData,
        },
      )

      const packedUserOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature: '0x',
      })

      // Step 3: Get signature from verifyingSigner account and create paymaster data.
      const paymasterValidUntil = 0
      const paymasterValidAfter = 0
      const paymasterHash = await paymaster.getHash(packedUserOp, paymasterValidAfter, paymasterValidUntil)
      const paymasterSignature = await verifyingSigner.signMessage(ethers.getBytes(paymasterHash))
      const paymasterData = ethers.solidityPacked(
        ['bytes', 'bytes'],
        [ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [paymasterValidAfter, paymasterValidUntil]), paymasterSignature],
      )

      paymasterAndData = ethers.solidityPacked(
        ['address', 'uint128', 'uint128', 'bytes'],
        [paymaster.target, paymasterVerificationGasLimit, paymasterPostOpGasLimit, paymasterData],
      )

      packedUserOp.paymasterAndData = paymasterAndData

      // Step 4: Sign userOp with Passkey signer.
      // opHash that will be signed using Passkey credentials
      const opHash = await module.getOperationHash(packedUserOp)

      const assertion = navigator.credentials.get({
        publicKey: {
          challenge: ethers.getBytes(opHash),
          rpId: 'safe.global',
          allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
          userVerification: 'required',
        },
      })

      // Build the contract signature that a Safe will forward to the signer contract
      const signature = buildSignatureBytes([
        {
          signer: signer,
          data: encodeWebAuthnSignature(assertion.response),
          dynamic: true,
        },
      ])

      // Set the signature in the packedUserOp
      packedUserOp.signature = ethers.solidityPacked(['uint48', 'uint48', 'bytes'], [safeOp.validAfter, safeOp.validUntil, signature])

      // Send 1 ETH to the Safe
      await relayer.sendTransaction({ to: safeAddress, value: ethers.parseEther('1') })
      const balanceBefore = await ethers.provider.getBalance(ethers.ZeroAddress)

      // Step 5: Execute the userOp that with an existing Safe with passkey signer as owner using Paymaster
      await entryPoint.handleOps([packedUserOp], relayer.address)

      // Check if the address(0) received 0.2 ETH
      expect(await ethers.provider.getBalance(ethers.ZeroAddress)).to.be.equal(balanceBefore + ethers.parseEther('0.2'))
      expect(await ethers.provider.getBalance(safeAddress)).to.be.equal(ethers.parseEther('1') - ethers.parseEther('0.2'))
    })
  })
})
