import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { Signer } from 'ethers'
import { getTestSafe, getSafe4337Module, getEntryPoint } from '../utils/setup'
import { buildSignatureBytes, signHash } from '../../src/utils/execution'
import {
  buildSafeUserOp,
  buildSafeUserOpTransaction,
  buildUserOperationFromSafeUserOperation,
  calculateSafeOperationHash,
  packValidationData,
} from '../../src/utils/userOp'
import { chainId, timestamp } from '../utils/encoding'

describe('Safe4337Module', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user, untrusted] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const module = await getSafe4337Module()
    const makeSafeModule = async (user: Signer) => {
      const safe = await getTestSafe(user, await module.getAddress(), await module.getAddress())
      return await ethers.getContractAt('Safe4337Module', await safe.getAddress())
    }
    const safeModule = await makeSafeModule(user)

    return {
      user,
      untrusted,
      entryPoint,
      validator: module,
      safeModule,
      makeSafeModule,
    }
  })

  describe('getOperationHash', () => {
    it.only('should correctly calculate EIP-712 hash of the operation', async () => {
      const { validator, safeModule, entryPoint } = await setupTests()

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
        signature: buildSignatureBytes([]),
      })
      const operationHash = await safeModule.getOperationHash(userOp)

      expect(operationHash).to.equal(calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId()))
    })
  })

  describe('constructor', () => {
    it('should revert when entry point is not specified', async () => {
      const factory = await ethers.getContractFactory('Safe4337Module')
      await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWith('Invalid entry point')
    })
  })

  describe('validateUserOp', () => {
    it('should revert when validating user ops for a different Safe', async () => {
      const { user, entryPoint, validator, safeModule, makeSafeModule } = await setupTests()

      const safeOp = buildSafeUserOpTransaction(await safeModule.getAddress(), user.address, 0, '0x', '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      const entryPointImpersonator = await ethers.getSigner(await entryPoint.getAddress())
      const safeFromEntryPoint = safeModule.connect(entryPointImpersonator)
      expect(await safeFromEntryPoint.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.eq(0)

      const otherSafe = (await makeSafeModule(user)).connect(entryPointImpersonator)
      await expect(otherSafe.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.be.revertedWith('Invalid caller')
    })

    it('should revert when calling an unsupported Safe method', async () => {
      const { user, untrusted, entryPoint, validator, safeModule } = await setupTests()

      const abi = ['function addOwnerWithThreshold(address owner, uint256 threshold) external']
      const callData = new ethers.Interface(abi).encodeFunctionData('addOwnerWithThreshold', [untrusted.address, 1])
      const safeOp = buildSafeUserOp({
        safe: await safeModule.getAddress(),
        callData,
        nonce: '0',
        entryPoint: await entryPoint.getAddress(),
      })
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      const entryPointAddress = await ethers.getSigner(await entryPoint.getAddress())
      const safeFromEntryPoint = safeModule.connect(entryPointAddress)
      await expect(safeFromEntryPoint.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.be.revertedWith(
        'Unsupported execution function id',
      )
    })

    it('should revert when not called from the trusted entrypoint', async () => {
      const { user, untrusted, entryPoint, validator, safeModule } = await setupTests()
      const safeOp = buildSafeUserOpTransaction(await safeModule.getAddress(), user.address, 0, '0x', '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await expect(safeModule.connect(untrusted).validateUserOp(userOp, ethers.ZeroHash, 0)).to.be.revertedWith('Unsupported entry point')
    })

    it('should return correct validAfter and validUntil timestamps', async () => {
      const { user, safeModule, validator, entryPoint } = await setupTests()

      const validAfter = BigInt(ethers.hexlify(ethers.randomBytes(3)))
      const validUntil = validAfter + BigInt(ethers.hexlify(ethers.randomBytes(3)))

      const safeOp = buildSafeUserOpTransaction(
        await safeModule.getAddress(),
        user.address,
        0,
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          validAfter,
          validUntil,
        },
      )

      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)], validAfter, validUntil)
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      const packedValidationData = packValidationData(0, validUntil, validAfter)
      const entryPointImpersonator = await ethers.getSigner(await entryPoint.getAddress())
      const safeFromEntryPoint = safeModule.connect(entryPointImpersonator)

      expect(await safeFromEntryPoint.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.eq(packedValidationData)
    })
  })

  describe('execUserOp', () => {
    it('should revert when not called from the trusted entrypoint', async () => {
      const { untrusted, safeModule } = await setupTests()
      await expect(safeModule.connect(untrusted).executeUserOp(ethers.ZeroAddress, 0, '0x', 0)).to.be.revertedWith(
        'Unsupported entry point',
      )
    })
  })

  describe('execUserOpWithErrorString', () => {
    it('should revert when not called from the trusted entrypoint', async () => {
      const { untrusted, safeModule } = await setupTests()
      await expect(safeModule.connect(untrusted).executeUserOpWithErrorString(ethers.ZeroAddress, 0, '0x', 0)).to.be.revertedWith(
        'Unsupported entry point',
      )
    })
  })
})
