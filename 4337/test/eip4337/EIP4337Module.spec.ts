import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { Signer } from 'ethers'
import { getTestSafe, getSimple4337Module, getEntryPoint } from '../utils/setup'
import { buildSignatureBytes, signHash, logGas } from '../../src/utils/execution'
import {
  buildSafeUserOp,
  calculateSafeOperationHash,
  buildUserOperationFromSafeUserOperation,
  buildSafeUserOpTransaction,
  signSafeOp,
} from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'

describe('Simple4337Module', async () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user, untrusted] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const module = await getSimple4337Module()
    const makeSafeModule = async (user: Signer) => {
      const safe = await getTestSafe(user, await module.getAddress(), await module.getAddress())
      return await ethers.getContractAt('Simple4337Module', await safe.getAddress())
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

  describe('validateUserOp', () => {
    it('should revert when validating user ops for a different Safe', async () => {
      const { user, entryPoint, validator, safeModule, makeSafeModule } = await setupTests()

      const safeOp = buildSafeUserOpTransaction(await safeModule.getAddress(), user.address, 0, '0x', '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeAddress: await safeModule.getAddress(),
        safeOp,
        signature,
      })

      const entryPointImpersonator = await ethers.getSigner(await entryPoint.getAddress())
      const safeFromEntryPoint = safeModule.connect(entryPointImpersonator)
      expect(await safeFromEntryPoint.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.eq(0)

      const otherSafe = (await makeSafeModule(user)).connect(entryPointImpersonator)
      await expect(otherSafe.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.be.revertedWith('Invalid Caller')
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
        safeAddress: await safeModule.getAddress(),
        safeOp,
        signature,
      })

      await expect(safeModule.validateUserOp(userOp, ethers.ZeroHash, 0)).to.be.revertedWith('Unsupported execution function id')
    })

    it('should revert when not called from the trusted entrypoint', async () => {
      const { user, untrusted, entryPoint, validator, safeModule } = await setupTests()
      const safeOp = buildSafeUserOpTransaction(await safeModule.getAddress(), user.address, 0, '0x', '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeAddress: await safeModule.getAddress(),
        safeOp,
        signature,
      })

      await expect(safeModule.connect(untrusted).validateUserOp(userOp, ethers.ZeroHash, 0)).to.be.revertedWith('Unsupported entry point')
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
