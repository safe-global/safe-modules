import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getTestSafe, getSafe4337Module, getEntryPoint } from '../utils/setup'
import { buildSignatureBytes, signHash, logGas } from '../../src/utils/execution'
import { calculateSafeOperationHash, buildUserOperationFromSafeUserOperation, buildSafeUserOpTransaction } from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'

describe('Safe4337Module - Existing Safe', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user1, relayer] = await ethers.getSigners()
    let entryPoint = await getEntryPoint()
    entryPoint = entryPoint.connect(relayer)
    const module = await getSafe4337Module()
    const safe = await getTestSafe(user1, await module.getAddress(), await module.getAddress())

    return {
      user1,
      safe,
      relayer,
      validator: module,
      entryPoint,
    }
  })

  describe('handleOps [- existing] account', () => {
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
      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
        .withArgs(0, 'AA24 signature error')

      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('1.0'))
    })

    it('should execute contract calls without fee', async () => {
      const { user1, safe, validator, entryPoint, relayer } = await setupTests()

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
      await logGas('Execute UserOp without fee payment', entryPoint.handleOps([userOp], relayer))
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.5'))
    })

    it('should not be able to execute contract calls twice', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()
      const randomAddress = ethers.Wallet.createRandom().address

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
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })
      await entryPoint.handleOps([userOp], user1.address)
      expect(await ethers.provider.getBalance(randomAddress)).to.be.eq(ethers.parseEther('0.5'))
      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
        .withArgs(0, 'AA25 invalid account nonce')
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

    it('reverts on failure', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      // Make sure to send enough ETH for the pre-fund but less than the transaction
      await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('0.4') })
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.4'))
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
      const userOpHash = await entryPoint.getUserOpHash(userOp)
      // Error('Execution failed')
      const expectedReturnData =
        '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010457865637574696f6e206661696c656400000000000000000000000000000000'

      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.emit(entryPoint, 'UserOperationRevertReason')
        .withArgs(userOpHash, userOp.sender, 0, expectedReturnData)
    })

    it('executeUserOpWithErrorString should execute contract calls', async () => {
      const { user1, safe, validator, entryPoint, relayer } = await setupTests()

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
        {
          maxFeePerGas: '0',
        },
      )
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })
      await logGas('Execute UserOp without fee payment and bubble up error string', entryPoint.handleOps([userOp], relayer))
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther('0.5'))
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
      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })

      // Error('You called a function that always reverts')
      const expectedRevertReason =
        '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000029596f752063616c6c656420612066756e6374696f6e207468617420616c7761797320726576657274730000000000000000000000000000000000000000000000'

      await expect(entryPoint.handleOps([userOp], user1.address))
        .to.emit(entryPoint, 'UserOperationRevertReason')
        .withArgs(await entryPoint.getUserOpHash(userOp), safeOp.safe, 0, expectedRevertReason)
    })
  })
})
