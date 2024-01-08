import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getSafe4337Module, getEntryPoint, getFactory, getAddModulesLib, getSafeL2Singleton } from '../utils/setup'
import { buildSignatureBytes, logGas } from '../../src/utils/execution'
import { buildUserOperationFromSafeUserOperation, buildSafeUserOpTransaction, signSafeOp } from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { Safe4337 } from '../../src/utils/safe'

describe('Safe4337Module - Newly deployed safe', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user1] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const module = await getSafe4337Module()
    const proxyFactory = await getFactory()
    const proxyCreationCode = await proxyFactory.proxyCreationCode()
    const addModulesLib = await getAddModulesLib()
    const singleton = await getSafeL2Singleton()
    const safe = await Safe4337.withSigner(user1.address, {
      safeSingleton: await singleton.getAddress(),
      entryPoint: await entryPoint.getAddress(),
      erc4337module: await module.getAddress(),
      proxyFactory: await proxyFactory.getAddress(),
      addModulesLib: await addModulesLib.getAddress(),
      proxyCreationCode,
      chainId: Number(await chainId()),
    })

    return {
      user1,
      safe: safe.connect(ethers.provider),
      proxyFactory,
      addModulesLib,
      validator: module,
      entryPoint,
    }
  })

  describe('executeUserOp - new account', () => {
    it('should revert with invalid signature', async () => {
      const { user1, safe, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, user1.address, safeOp, await chainId())])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await expect(entryPoint.executeUserOp(userOp, 0)).to.be.revertedWith('Signature validation failed')
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
    })

    it('should execute contract calls without fee', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await logGas('Execute UserOp without fee payment', entryPoint.executeUserOp(userOp, 0))
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('0.5'))
    })

    it('should not be able to execute contract calls twice', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await entryPoint.executeUserOp(userOp, 0)
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('0.5'))
      await expect(entryPoint.executeUserOp(userOp, 0)).to.be.revertedWithCustomError(entryPoint, 'InvalidNonce').withArgs(0)
    })

    it('reverts on failure', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('0.000001') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('0.000001'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      const transaction = await logGas('Execute UserOp without fee payment', entryPoint.executeUserOp(userOp, 0))
      const receipt = await transaction.wait()
      const logs = receipt.logs.map((log) => entryPoint.interface.parseLog(log))
      const emittedRevert = logs.some((log) => log?.name === 'UserOpReverted')
      expect(emittedRevert).to.be.true
      expect(await safe.isDeployed()).to.be.true
    })

    it('should execute contract calls with fee', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await logGas('Execute UserOp with fee payment', entryPoint.executeUserOp(userOp, ethers.parseEther('0.000001')))
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('0.499999'))
    })

    it('executeUserOpWithErrorString should execute contract calls', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user1.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        true,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      await logGas(
        'Execute UserOp with fee payment and bubble up error string',
        entryPoint.executeUserOp(userOp, ethers.parseEther('0.000001')),
      )
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('0.499999'))
    })

    it('executeUserOpWithErrorString reverts on failure and bubbles up the revert reason', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      const reverterContract = await ethers.getContractFactory('TestReverter').then((factory) => factory.deploy())
      const callData = reverterContract.interface.encodeFunctionData('alwaysReverting')

      await user1.sendTransaction({ to: safe.address, value: ethers.parseEther('1.0') })
      expect(await ethers.provider.getBalance(safe.address)).to.be.eq(ethers.parseEther('1.0'))
      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        await reverterContract.getAddress(),
        0,
        callData,
        '0',
        await entryPoint.getAddress(),
        false,
        true,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user1, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      const transaction = await logGas('Execute UserOp without fee payment', entryPoint.executeUserOp(userOp, 0))
      const receipt = await transaction.wait()
      const logs = receipt.logs.map((log) => entryPoint.interface.parseLog(log))
      const emittedRevert = logs.find((log) => log?.name === 'UserOpReverted')
      expect(emittedRevert?.args.reason).to.equal(
        reverterContract.interface.encodeErrorResult('Error', ['You called a function that always reverts']),
      )
      expect(await safe.isDeployed()).to.be.true
    })
  })
})
