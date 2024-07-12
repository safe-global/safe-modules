import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import {
  getSafe4337Module,
  getEntryPoint,
  getFactory,
  getSafeModuleSetup,
  getSafeL2Singleton,
  getEntryPointSimulations,
} from '../utils/setup'
import { buildSignatureBytes, logUserOperationGas } from '../../src/utils/execution'
import {
  buildPackedUserOperationFromSafeUserOperation,
  buildSafeUserOpTransaction,
  calculateSafeOperationData,
  getRequiredPrefund,
  signSafeOp,
} from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { Safe4337 } from '../../src/utils/safe'
import { estimateUserOperationGas } from '../utils/simulations'

describe('Safe4337Module - Newly deployed safe', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user1, relayer] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const entryPointSimulations = await getEntryPointSimulations()
    const module = await getSafe4337Module()
    const proxyFactory = await getFactory()
    const proxyCreationCode = await proxyFactory.proxyCreationCode()
    const safeModuleSetup = await getSafeModuleSetup()
    const singleton = await getSafeL2Singleton()
    const safeGlobalConfig = {
      safeSingleton: await singleton.getAddress(),
      entryPoint: await entryPoint.getAddress(),
      erc4337module: await module.getAddress(),
      proxyFactory: await proxyFactory.getAddress(),
      safeModuleSetup: await safeModuleSetup.getAddress(),
      proxyCreationCode,
      chainId: Number(await chainId()),
    }

    const safe = Safe4337.withSigner(user1.address, safeGlobalConfig)

    return {
      user1,
      safe: safe.connect(ethers.provider),
      proxyFactory,
      safeModuleSetup,
      validator: module,
      entryPoint,
      entryPointSimulations,
      relayer,
      safeGlobalConfig,
    }
  })

  describe('executeUserOp - new account', () => {
    it('should revert with invalid signature', async () => {
      const { user1, safe, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, user1.address, safeOp, await chainId())])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
        .withArgs(0, 'AA24 signature error')

      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
    })

    it('should execute contract calls without a prefund required', async () => {
      const { user1, safe, validator, entryPoint, entryPointSimulations } = await setupTests()
      const entryPointAddress = await entryPoint.getAddress()

      await entryPoint.depositTo(await safe.address, { value: ethers.parseEther('1.0') })

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('0.5') })
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const gasEstimation = await estimateUserOperationGas(ethers.provider, entryPointSimulations, safeOp, entryPointAddress)
      safeOp.callGasLimit = gasEstimation.callGasLimit
      safeOp.preVerificationGas = gasEstimation.preVerificationGas
      safeOp.verificationGasLimit = gasEstimation.verificationGasLimit
      safeOp.maxFeePerGas = gasEstimation.maxFeePerGas
      safeOp.maxPriorityFeePerGas = gasEstimation.maxPriorityFeePerGas
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await logUserOperationGas('Execute UserOp without fee payment', entryPoint, entryPoint.handleOps([userOp], user1.address))
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('0'))
    })

    it('should revert when signature length contains additional bytes - EOA signature', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await entryPoint.depositTo(safe.address, { value: ethers.parseEther('1.0') })

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('0.5') })
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )

      // Add additional byte to the signature to make signature length invalid
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())]).concat('00')
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
        .withArgs(0, 'AA24 signature error')
    })

    it('should revert when signature length contains additional bytes - Smart contract signature', async () => {
      const { user1, relayer, safe: parentSafe, validator, entryPoint, safeGlobalConfig } = await setupTests()

      await parentSafe.deploy(user1)

      const daughterSafe = Safe4337.withSigner(parentSafe.address, safeGlobalConfig)

      const accountBalance = ethers.parseEther('1.0')
      await user1.sendTransaction({ to: daughterSafe.address, value: accountBalance })
      expect(await ethers.provider.getBalance(daughterSafe.address)).to.be.eq(accountBalance)

      const safeOp = buildSafeUserOpTransaction(
        daughterSafe.address,
        user1.address,
        ethers.parseEther('0.1'),
        '0x',
        '0x0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: daughterSafe.getInitCode(),
        },
      )

      const opData = calculateSafeOperationData(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([
        {
          signer: parentSafe.address,
          data: await user1.signTypedData(
            {
              verifyingContract: parentSafe.address,
              chainId: await chainId(),
            },
            {
              SafeMessage: [{ type: 'bytes', name: 'message' }],
            },
            {
              message: opData,
            },
          ),
          dynamic: true,
        },
      ])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature: signature.concat('00'), // adding '00' invalidates signature length
      })

      await expect(entryPoint.handleOps([userOp], await relayer.getAddress()))
        .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
        .withArgs(0, 'AA24 signature error')
    })

    it('should revert when signature offset points to invalid part of signature data - Smart contract signature', async () => {
      const { user1, relayer, safe: parentSafe, validator, entryPoint, safeGlobalConfig } = await setupTests()

      await parentSafe.deploy(user1)

      const daughterSafe = Safe4337.withSigner(parentSafe.address, safeGlobalConfig)

      const accountBalance = ethers.parseEther('1.0')
      await user1.sendTransaction({ to: daughterSafe.address, value: accountBalance })
      expect(await ethers.provider.getBalance(daughterSafe.address)).to.be.eq(accountBalance)

      const safeOp = buildSafeUserOpTransaction(
        daughterSafe.address,
        user1.address,
        ethers.parseEther('0.1'),
        '0x',
        '0x0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: daughterSafe.getInitCode(),
        },
      )

      const opData = calculateSafeOperationData(await validator.getAddress(), safeOp, await chainId())
      const parentSafeSignature = await user1.signTypedData(
        {
          verifyingContract: parentSafe.address,
          chainId: await chainId(),
        },
        {
          SafeMessage: [{ type: 'bytes', name: 'message' }],
        },
        {
          message: opData,
        },
      )

      // The 2nd word of static part of signature containing invalid value pointing to dynamic part
      const signature = ethers.concat([
        ethers.zeroPadValue(parentSafe.address, 32), // address of the signer
        ethers.toBeHex(0, 32), // offset of the start of the signature
        '0x00', // contract signature type
        ethers.toBeHex(ethers.dataLength(parentSafeSignature), 32), // length of the dynamic signature
        parentSafeSignature,
      ])

      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await expect(entryPoint.handleOps([userOp], await relayer.getAddress()))
        .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
        .withArgs(0, 'AA24 signature error')
    })

    it('should not be able to execute contract calls twice', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      await safe.deploy(user1)

      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await entryPoint.handleOps([userOp], user1.address)

      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
        .withArgs(0, 'AA25 invalid account nonce')
    })

    it('reverts on failure', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('0.05') })
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      const expectedReturnData = validator.interface.encodeErrorResult('ExecutionFailed()', [])
      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.emit(entryPoint, 'UserOperationRevertReason')
        .withArgs(await entryPoint.getUserOpHash(userOp), userOp.sender, 0, expectedReturnData)
    })

    it('should execute contract calls with fee', async () => {
      const { user1, safe, validator, entryPoint, entryPointSimulations } = await setupTests()
      const entryPointAddress = await entryPoint.getAddress()
      const feeBeneficiary = ethers.Wallet.createRandom().address
      const randomAddress = ethers.Wallet.createRandom().address

      expect(await ethers.provider.getBalance(feeBeneficiary)).to.be.eq(0)
      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        randomAddress,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const gasEstimation = await estimateUserOperationGas(ethers.provider, entryPointSimulations, safeOp, entryPointAddress)
      safeOp.callGasLimit = gasEstimation.callGasLimit
      safeOp.preVerificationGas = gasEstimation.preVerificationGas
      safeOp.verificationGasLimit = gasEstimation.verificationGasLimit
      safeOp.maxFeePerGas = gasEstimation.maxFeePerGas
      safeOp.maxPriorityFeePerGas = gasEstimation.maxPriorityFeePerGas
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await logUserOperationGas('Execute UserOp with fee payment', entryPoint, entryPoint.handleOps([userOp], feeBeneficiary))

      // checking that the fee was paid
      expect(await ethers.provider.getBalance(feeBeneficiary)).to.be.gt(0)
      // check that the call was executed
      expect(await ethers.provider.getBalance(randomAddress)).to.be.eq(ethers.parseEther('0.5'))
    })

    it('executeUserOpWithErrorString should execute contract calls', async () => {
      const { user1, safe, validator, entryPoint, entryPointSimulations } = await setupTests()
      const entryPointAddress = await entryPoint.getAddress()

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        true,
        {
          initCode: safe.getInitCode(),
        },
      )
      const gasEstimation = await estimateUserOperationGas(ethers.provider, entryPointSimulations, safeOp, entryPointAddress)
      safeOp.callGasLimit = gasEstimation.callGasLimit
      safeOp.preVerificationGas = gasEstimation.preVerificationGas
      safeOp.verificationGasLimit = gasEstimation.verificationGasLimit
      safeOp.maxFeePerGas = gasEstimation.maxFeePerGas
      safeOp.maxPriorityFeePerGas = gasEstimation.maxPriorityFeePerGas
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await logUserOperationGas(
        'Execute UserOp with fee payment and bubble up error string',
        entryPoint,
        entryPoint.handleOps([userOp], user1.address),
      )
      const paidPrefund = getRequiredPrefund(userOp)
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('0.5') - paidPrefund)
    })

    it('executeUserOpWithErrorString reverts on failure and bubbles up the revert reason', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      const reverterContract = await ethers.getContractFactory('TestReverter').then((factory) => factory.deploy())
      const callData = reverterContract.interface.encodeFunctionData('alwaysReverting')

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        await reverterContract.getAddress(),
        0,
        callData,
        '0',
        await entryPoint.getAddress(),
        false,
        true,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      // Error('You called a function that always reverts')
      const expectedRevertReason = validator.interface.encodeErrorResult('Error(string)', ['You called a function that always reverts'])
      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.emit(entryPoint, 'UserOperationRevertReason')
        .withArgs(await entryPoint.getUserOpHash(userOp), safeOp.safe, 0, expectedRevertReason)

      await expect(ethers.provider.getCode(safe.address)).to.not.eq('0x')
    })
  })
})
