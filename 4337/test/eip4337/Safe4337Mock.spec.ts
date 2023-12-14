import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getEntryPoint, get4337TestSafe } from '../utils/setup'
import { buildSignatureBytes, signHash, logGas } from '../../src/utils/execution'
import { buildSafeUserOpTransaction, buildUserOperationFromSafeUserOperation, calculateSafeOperationHash } from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'

describe('Safe4337Mock', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user1] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const safe = await get4337TestSafe(user1, ethers.ZeroAddress, ethers.ZeroAddress)
    const safe4337 = await ethers.getContractAt('Safe4337Module', await safe.getAddress())

    return {
      user1,
      safe,
      validator: safe4337,
      entryPoint,
    }
  })

  describe('executeUserOp', () => {
    it('should execute contract calls without fee', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
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
      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })
      await logGas('Execute UserOp without fee payment', entryPoint.executeUserOp(userOp, 0))
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.5'))
    })

    it('should execute contract calls with fee', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
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
      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })
      await logGas('Execute UserOp with fee payment', entryPoint.executeUserOp(userOp, ethers.parseEther('0.000001')))
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.499999'))
    })
  })
})
