import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getTestSafe, getSafe4337Module, getEntryPoint } from '../utils/setup'
import { buildSignatureBytes, signHash, logGas } from '../../src/utils/execution'
import { calculateSafeOperationHash, buildUserOperationFromSafeUserOperation, buildSafeUserOpTransaction } from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'

describe('Safe4337Module - Existing Safe', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user1] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const module = await getSafe4337Module()
    const safe = await getTestSafe(user1, await module.getAddress(), await module.getAddress())

    return {
      user1,
      safe,
      validator: module,
      entryPoint,
    }
  })

  describe('executeUserOp - existing account', () => {
    it('should revert with invalid signature', async () => {
      const { user1, safe, entryPoint } = await setupTests()

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
      const signature = buildSignatureBytes([await signHash(user1, ethers.keccak256('0xbaddad42'))])
      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })
      await expect(entryPoint.executeUserOp(userOp, 0)).to.be.revertedWith('Signature validation failed')
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
    })

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

    it('should not be able to execute contract calls twice', async () => {
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
      await entryPoint.executeUserOp(userOp, 0)
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.5'))
      await expect(entryPoint.executeUserOp(userOp, 0)).to.be.revertedWithCustomError(entryPoint, 'InvalidNonce').withArgs(0)
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

    it('reverts on failure', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('0.000001') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.000001'))
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

      const transaction = await entryPoint.executeUserOp(userOp, ethers.parseEther('0.000001')).then((tx) => tx.wait())
      const logs = transaction.logs.map((log) => entryPoint.interface.parseLog(log))
      const emittedRevert = logs.some((l) => l?.name === 'UserOpReverted')

      expect(emittedRevert).to.be.true
    })

    it('executeUserOpWithErrorString should execute contract calls', async () => {
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
        true,
      )
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })
      await logGas('Execute UserOp without fee payment and bubble up error string', entryPoint.executeUserOp(userOp, 0))
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.5'))
    })

    it('executeUserOpWithErrorString reverts on failure and bubbles up the revert reason', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()
      const reverterContract = await ethers.getContractFactory('TestReverter').then((factory) => factory.deploy())
      const callData = reverterContract.interface.encodeFunctionData('alwaysReverting')

      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('0.000001') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.000001'))
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
      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })

      const transaction = await entryPoint.executeUserOp(userOp, ethers.parseEther('0.000001')).then((tx) => tx.wait())
      const logs = transaction.logs.map((log) => entryPoint.interface.parseLog(log)) ?? []
      const emittedRevert = logs.find((l) => l?.name === 'UserOpReverted')
      expect(emittedRevert?.args.reason).to.equal(
        reverterContract.interface.encodeErrorResult('Error', ['You called a function that always reverts']),
      )
    })
  })
})