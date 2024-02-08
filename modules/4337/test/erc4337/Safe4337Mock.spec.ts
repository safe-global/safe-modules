import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getEntryPoint, get4337TestSafe } from '../utils/setup'
import { buildSignatureBytes, signHash, logGas } from '../../src/utils/execution'
import {
  buildSafeUserOp,
  buildSafeUserOpTransaction,
  buildUserOperationFromSafeUserOperation,
  calculateSafeOperationHash,
} from '../../src/utils/userOp'
import { chainId, timestamp } from '../utils/encoding'

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
        false,
        false,
        {
          maxFeePerGas: '0',
        },
      )
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })
      await logGas('Execute UserOp without fee payment', entryPoint.handleOps([userOp], user1.address))
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.5'))
    })

    it('should execute contract calls with fee', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()
      const randomAddress = ethers.Wallet.createRandom().address
      const randomAddress2 = ethers.Wallet.createRandom().address

      expect(await ethers.provider.getBalance(randomAddress)).to.be.eq(0)
      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        await safe.getAddress(),
        randomAddress2,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
      )
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })
      await logGas('Execute UserOp with fee payment', entryPoint.handleOps([userOp], randomAddress))

      // checking that the fee was paid
      expect(await ethers.provider.getBalance(randomAddress)).to.be.gt(0)
      // check that the call was executed
      expect(await ethers.provider.getBalance(randomAddress2)).to.be.eq(ethers.parseEther('0.5'))
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
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature: '0x',
      })

      const operationHash = await validator.getOperationHash(userOp)
      const calculatedOperationHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      expect(operationHash).to.eq(calculatedOperationHash)
    })
  })
})
