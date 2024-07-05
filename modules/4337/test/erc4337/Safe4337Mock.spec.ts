import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getEntryPoint, get4337TestSafe, getEntryPointSimulations } from '../utils/setup'
import { buildSignatureBytes, signHash, logUserOperationGas } from '../../src/utils/execution'
import {
  buildSafeUserOp,
  buildSafeUserOpTransaction,
  buildPackedUserOperationFromSafeUserOperation,
  calculateSafeOperationHash,
  getRequiredPrefund,
} from '../../src/utils/userOp'
import { chainId, timestamp } from '../utils/encoding'
import { estimateUserOperationGas } from '../utils/simulations'

describe('Safe4337Mock', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user1] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const entryPointSimulations = await getEntryPointSimulations()
    const safe = await get4337TestSafe(user1, ethers.ZeroAddress, ethers.ZeroAddress)
    const safe4337 = await ethers.getContractAt('Safe4337Module', await safe.getAddress())

    return {
      user1,
      safe,
      validator: safe4337,
      entryPoint,
      entryPointSimulations,
    }
  })

  describe('executeUserOp', () => {
    it('should execute contract calls without fee', async () => {
      const { user1, safe, validator, entryPoint, entryPointSimulations } = await setupTests()
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
        false,
        {
          maxFeePerGas: '0',
        },
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
      await logUserOperationGas('Execute UserOp without fee payment', entryPoint, entryPoint.handleOps([userOp], user1.address))
      const paidPrefund = getRequiredPrefund(userOp)
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.5') - paidPrefund)
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
      safeOp.maxFeePerGas = gasEstimation.maxFeePerGas
      safeOp.maxPriorityFeePerGas = gasEstimation.maxPriorityFeePerGas
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })
      await logUserOperationGas('Execute UserOp with fee payment', entryPoint, entryPoint.handleOps([userOp], feeBeneficiary))

      // checking that the fee was paid
      expect(await ethers.provider.getBalance(feeBeneficiary)).to.be.gt(0)
      // check that the call was executed
      expect(await ethers.provider.getBalance(randomAddress)).to.be.eq(ethers.parseEther('0.5'))
    })
  })

  describe('constants', () => {
    it('should correctly calculate keccak of DOMAIN_SEPARATOR_TYPEHASH', async () => {
      const { validator } = await setupTests()

      const domainSeparator = await validator.domainSeparator()
      const calculatedDomainSeparatorTypehash = ethers.keccak256(
        ethers.toUtf8Bytes('EIP712Domain(uint256 chainId,address verifyingContract)'),
      )
      const calculatedDomainSeparator = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'uint256', 'address'],
          [calculatedDomainSeparatorTypehash, await chainId(), await validator.getAddress()],
        ),
      )
      expect(domainSeparator).to.eq(calculatedDomainSeparator)
    })

    it('should correctly calculate keccak of SAFE_OP_TYPEHASH', async () => {
      const { entryPoint, validator } = await setupTests()

      const safeAddress = ethers.hexlify(ethers.randomBytes(20))
      const validAfter = (await timestamp()) + 10000
      const validUntil = validAfter + 10000000000
      const safeOp = buildSafeUserOp({
        safe: safeAddress,
        nonce: '0',
        entryPoint: await entryPoint.getAddress(),
        validAfter,
        validUntil,
      })
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature: '0x',
      })

      const operationHash = await validator.getOperationHash(userOp)
      const calculatedOperationHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      expect(operationHash).to.eq(calculatedOperationHash)
    })
  })
})
