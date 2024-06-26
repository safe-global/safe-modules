import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getTestSafe, getSafe4337Module, getEntryPoint, getEntryPointSimulations } from '../utils/setup'
import { buildSignatureBytes, signHash, logUserOperationGas } from '../../src/utils/execution'
import {
  calculateSafeOperationHash,
  buildPackedUserOperationFromSafeUserOperation,
  buildSafeUserOpTransaction,
  getRequiredPrefund,
} from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { estimateUserOperationGas } from '../utils/simulations'

describe('Safe4337Module - Existing Safe', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user1, relayer] = await ethers.getSigners()
    const entryPoint = await getEntryPoint().then((entryPoint) => entryPoint.connect(relayer))
    const entryPointSimulations = await getEntryPointSimulations()
    const module = await getSafe4337Module()
    const safe = await getTestSafe(user1, await module.getAddress(), await module.getAddress())

    return {
      user1,
      safe,
      relayer,
      validator: module,
      entryPoint,
      entryPointSimulations,
    }
  })

  describe('handleOps - existing account', () => {
    it('should revert with invalid signature', async () => {
      const { user1, safe, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('1.0') })
      const safeOp = buildSafeUserOpTransaction(
        await safe.getAddress(),
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
      )
      const signature = buildSignatureBytes([await signHash(user1, ethers.keccak256('0xbaddad42'))])
      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })
      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
        .withArgs(0, 'AA24 signature error')

      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
    })

    it('should execute contract calls without a prefund required', async () => {
      const { user1, safe, validator, entryPoint, entryPointSimulations, relayer } = await setupTests()
      const entryPointAddress = await entryPoint.getAddress()

      await entryPoint.depositTo(await safe.getAddress(), { value: ethers.parseEther('1.0') })

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('0.5') })
      const safeOp = buildSafeUserOpTransaction(
        await safe.getAddress(),
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
      )
      const gasEstimation = await estimateUserOperationGas(ethers.provider, entryPointSimulations, safeOp, entryPointAddress)
      safeOp.callGasLimit = gasEstimation.callGasLimit
      safeOp.preVerificationGas = gasEstimation.preVerificationGas
      safeOp.verificationGasLimit = gasEstimation.verificationGasLimit
      safeOp.maxFeePerGas = gasEstimation.maxFeePerGas
      safeOp.maxPriorityFeePerGas = gasEstimation.maxPriorityFeePerGas
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })
      await logUserOperationGas('Execute UserOp without a prefund payment', entryPoint, entryPoint.handleOps([userOp], relayer))
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0'))
    })

    it('should not be able to execute contract calls twice', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()
      const receiver = ethers.Wallet.createRandom().address

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        await safe.getAddress(),
        receiver,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
      )
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })
      await entryPoint.handleOps([userOp], user1.address)
      expect(await ethers.provider.getBalance(receiver)).to.be.eq(ethers.parseEther('0.5'))
      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
        .withArgs(0, 'AA25 invalid account nonce')
    })

    it('should execute contract calls with fee', async () => {
      const { user1, safe, validator, entryPoint, entryPointSimulations } = await setupTests()
      const entryPointAddress = await entryPoint.getAddress()
      const feeBeneficiary = ethers.Wallet.createRandom().address
      const randomAddress = ethers.Wallet.createRandom().address

      expect(await ethers.provider.getBalance(feeBeneficiary)).to.be.eq(0)
      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        await safe.getAddress(),
        randomAddress,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
      )
      const gasEstimation = await estimateUserOperationGas(ethers.provider, entryPointSimulations, safeOp, entryPointAddress)
      safeOp.callGasLimit = gasEstimation.callGasLimit
      safeOp.preVerificationGas = gasEstimation.preVerificationGas
      safeOp.verificationGasLimit = gasEstimation.verificationGasLimit
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })
      await logUserOperationGas('Execute UserOp with fee payment', entryPoint, entryPoint.handleOps([userOp], feeBeneficiary))

      // checking that the fee was paid
      expect(await ethers.provider.getBalance(feeBeneficiary)).to.be.gt(0)
      // check that the call was executed
      expect(await ethers.provider.getBalance(randomAddress)).to.be.eq(ethers.parseEther('0.5'))
    })

    it('reverts on failure', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      // Make sure to send enough ETH for the pre-fund but less than the transaction
      await entryPoint.depositTo(await safe.getAddress(), { value: ethers.parseEther('1.0') })
      const safeOp = buildSafeUserOpTransaction(
        await safe.getAddress(),
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
      )
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })
      const userOpHash = await entryPoint.getUserOpHash(userOp)
      const expectedReturnData = validator.interface.encodeErrorResult('ExecutionFailed()', [])

      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.emit(entryPoint, 'UserOperationRevertReason')
        .withArgs(userOpHash, userOp.sender, 0, expectedReturnData)
    })

    it('executeUserOpWithErrorString should execute contract calls', async () => {
      const { user1, safe, validator, entryPoint, entryPointSimulations, relayer } = await setupTests()
      const entryPointAddress = await entryPoint.getAddress()

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        await safe.getAddress(),
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        true,
      )
      const gasEstimation = await estimateUserOperationGas(ethers.provider, entryPointSimulations, safeOp, entryPointAddress)
      safeOp.callGasLimit = gasEstimation.callGasLimit
      safeOp.preVerificationGas = gasEstimation.preVerificationGas
      safeOp.verificationGasLimit = gasEstimation.verificationGasLimit
      safeOp.maxFeePerGas = gasEstimation.maxFeePerGas
      safeOp.maxPriorityFeePerGas = gasEstimation.maxPriorityFeePerGas
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })
      await logUserOperationGas(
        'Execute UserOp without fee payment and bubble up error string',
        entryPoint,
        entryPoint.handleOps([userOp], relayer),
      )
      const paidPrefund = getRequiredPrefund(userOp)
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.5') - paidPrefund)
    })

    it('executeUserOpWithErrorString reverts on failure and bubbles up the revert reason', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()
      const reverterContract = await ethers.getContractFactory('TestReverter').then((factory) => factory.deploy())
      const callData = reverterContract.interface.encodeFunctionData('alwaysReverting')

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('0.5') })

      const safeOp = buildSafeUserOpTransaction(
        await safe.getAddress(),
        await reverterContract.getAddress(),
        0,
        callData,
        '0',
        await entryPoint.getAddress(),
        false,
        true,
      )
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })

      const expectedRevertReason = validator.interface.encodeErrorResult('Error(string)', ['You called a function that always reverts'])

      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.emit(entryPoint, 'UserOperationRevertReason')
        .withArgs(await entryPoint.getUserOpHash(userOp), safeOp.safe, 0, expectedRevertReason)
    })
  })
})
