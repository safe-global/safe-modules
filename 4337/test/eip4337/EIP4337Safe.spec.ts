import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getSimple4337Module, getEntryPoint, get4337TestSafe } from '../utils/setup'
import { buildSignatureBytes, signHash, logGas } from '../../src/utils/execution'
import {
  buildSafeUserOp,
  calculateSafeOperationHash,
  buildUserOperationFromSafeUserOperation,
  buildSafeUserOpTransaction,
} from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'

describe('EIP4337Safe', async () => {
  const [user1] = await ethers.getSigners()

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const entryPoint = await getEntryPoint()
    const safe = await get4337TestSafe(user1, ethers.ZeroAddress, ethers.ZeroAddress)
    const safe4337 = await ethers.getContractAt("Simple4337Module", await safe.getAddress());

    return {
      safe,
      validator: safe4337,
      entryPoint,
    }
  })

  describe('getOperationHash', () => {
    it('should correctly calculate EIP-712 hash of the operation', async () => {
      const { safe, validator, entryPoint } = await setupTests()

      const operation = buildSafeUserOp({ safe: await safe.getAddress(), nonce: '0', entryPoint: await entryPoint.getAddress() })
      const operationHash = await validator.getOperationHash(
        await safe.getAddress(),
        operation.callData,
        operation.nonce,
        operation.preVerificationGas,
        operation.verificationGasLimit,
        operation.callGasLimit,
        operation.maxFeePerGas,
        operation.maxPriorityFeePerGas,
        operation.entryPoint,
      )

      expect(operationHash).to.equal(calculateSafeOperationHash(await validator.getAddress(), operation, await chainId()))
    })
  })

  describe('execTransaction', () => {
    it('should execute contract calls without fee', async () => {
      const { safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(await safe.getAddress(), user1.address, ethers.parseEther('0.5'), '0x', '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({ safeAddress: await safe.getAddress(), safeOp, signature })
      await logGas('Execute UserOp without fee payment', entryPoint.executeUserOp(userOp, 0))
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.5'))
    })

    it('should execute contract calls with fee', async () => {
      const { safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(await safe.getAddress(), user1.address, ethers.parseEther('0.5'), '0x', '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({ safeAddress: await safe.getAddress(), safeOp, signature })
      await logGas('Execute UserOp with fee payment', entryPoint.executeUserOp(userOp, ethers.parseEther('0.000001')))
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.499999'))
    })
  })
})
