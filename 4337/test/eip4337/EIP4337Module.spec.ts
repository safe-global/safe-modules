import { expect } from 'chai'
import { deployments, ethers, waffle } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import { getTestSafe, getSimple4337Module, getEntryPoint } from '../utils/setup'
import { buildSignatureBytes, signHash, logGas } from '../../src/utils/execution'
import {
  buildSafeUserOp,
  calculateSafeOperationHash,
  buildUserOperationFromSafeUserOperation,
  buildSafeUserOpTransaction,
} from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'

describe('EIP4337Module', async () => {
  const [user1] = waffle.provider.getWallets()

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()
    
    const entryPoint = await getEntryPoint()
    const module = await getSimple4337Module()
    const safe = await getTestSafe(user1, module.address, module.address)

    return {
      safe,
      validator: module,
      entryPoint
    }
  })

  describe('getOperationHash', () => {
    it('should correctly calculate EIP-712 hash of the operation', async () => {
      const { safe, validator, entryPoint } = await setupTests()

      const operation = buildSafeUserOp({ safe: safe.address, nonce: '0', entryPoint: entryPoint.address })
      const operationHash = await validator.getOperationHash(
        safe.address,
        operation.callData,
        operation.nonce,
        operation.verificationGas,
        operation.preVerificationGas,
        operation.maxFeePerGas,
        operation.maxPriorityFeePerGas,
        operation.callGas,
        operation.entryPoint,
      )

      expect(operationHash).to.equal(calculateSafeOperationHash(validator.address, operation, await chainId()))
    })
  })

  describe('execTransaction', () => {
    it('should execute contract calls without fee', async () => {
      const { safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({to: safe.address, value: ethers.utils.parseEther("1.0")})
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.utils.parseEther("1.0"))
      const safeOp = buildSafeUserOpTransaction(safe.address, user1.address, ethers.utils.parseEther("0.5"), "0x", '0', entryPoint.address)
      const safeOpHash = calculateSafeOperationHash(validator.address, safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({safeAddress: safe.address, safeOp, signature})
      await logGas(
        "Execute UserOp without fee payment",
        entryPoint.executeUserOp(userOp, 0)
      )
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.utils.parseEther("0.5"))
    })

    it('should execute contract calls with fee', async () => {
      const { safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({to: safe.address, value: ethers.utils.parseEther("1.0")})
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.utils.parseEther("1.0"))
      const safeOp = buildSafeUserOpTransaction(safe.address, user1.address, ethers.utils.parseEther("0.5"), "0x", '0', entryPoint.address)
      const safeOpHash = calculateSafeOperationHash(validator.address, safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({safeAddress: safe.address, safeOp, signature})
      await logGas(
        "Execute UserOp with fee payment",
        entryPoint.executeUserOp(userOp, ethers.utils.parseEther("0.000001"))
      )
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.utils.parseEther("0.499999"))
    })
  })
})
