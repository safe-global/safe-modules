import { bundlerRpc, prepareAccounts, waitForUserOp } from '@safe-global/safe-4337-local-bundler'
import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { buildSignatureBytes } from '../../src/utils/execution'
import { buildRpcUserOperationFromSafeUserOperation, buildSafeUserOpTransaction, signSafeOp } from '../../src/utils/userOp'
import { chainId, timestamp } from '../utils/encoding'
import { Safe4337 } from '../../src/utils/safe'

describe('Local Bundler [@4337]', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = async () => {
    const { SafeModuleSetup, EntryPoint, HariWillibaldToken, Safe4337Module, SafeL2, SafeProxyFactory } = await deployments.run()
    const [user] = await prepareAccounts()
    const bundler = bundlerRpc()

    const entryPoint = new ethers.Contract(EntryPoint.address, EntryPoint.abi, ethers.provider)
    const validator = await ethers.getContractAt('Safe4337Module', Safe4337Module.address)
    const token = await ethers.getContractAt('HariWillibaldToken', HariWillibaldToken.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const proxyCreationCode = await proxyFactory.proxyCreationCode()

    const safe = Safe4337.withSigner(user.address, {
      safeSingleton: SafeL2.address,
      entryPoint: EntryPoint.address,
      erc4337module: Safe4337Module.address,
      proxyFactory: SafeProxyFactory.address,
      safeModuleSetup: SafeModuleSetup.address,
      proxyCreationCode,
      chainId: Number(await chainId()),
    })

    return {
      user,
      bundler,
      safe,
      validator,
      entryPoint,
      token,
    }
  }

  it('should deploy a new Safe and execute a transaction', async () => {
    const { user, bundler, safe, validator, entryPoint, token } = await setupTests()

    await token.transfer(safe.address, ethers.parseUnits('4.2', 18)).then((tx) => tx.wait())
    await user.sendTransaction({ to: safe.address, value: ethers.parseEther('0.5') }).then((tx) => tx.wait())

    expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)
    expect(await token.balanceOf(safe.address)).to.equal(ethers.parseUnits('4.2', 18))

    const validAfter = (await timestamp()) - 60
    const validUntil = validAfter + 300
    const safeOp = buildSafeUserOpTransaction(
      safe.address,
      await token.getAddress(),
      0,
      token.interface.encodeFunctionData('transfer', [user.address, await token.balanceOf(safe.address)]),
      await entryPoint.getNonce(safe.address, 0),
      await entryPoint.getAddress(),
      false,
      false,
      {
        initCode: safe.getInitCode(),
        validAfter,
        validUntil,
      },
    )
    const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
    const userOp = await buildRpcUserOperationFromSafeUserOperation({
      safeOp,
      signature,
    })

    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())

    await waitForUserOp(userOp)
    expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)
    expect(await token.balanceOf(safe.address)).to.equal(0)
    expect(await ethers.provider.getBalance(safe.address)).to.be.lessThan(ethers.parseEther('0.5'))
  })

  it('should execute a transaction for an exsiting Safe', async () => {
    const { user, bundler, safe, validator, entryPoint, token } = await setupTests()

    await safe.deploy(user)
    await token.transfer(safe.address, ethers.parseUnits('4.2', 18)).then((tx) => tx.wait())
    await user.sendTransaction({ to: safe.address, value: ethers.parseEther('0.5') }).then((tx) => tx.wait())

    expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)
    expect(await token.balanceOf(safe.address)).to.equal(ethers.parseUnits('4.2', 18))

    const safeOp = buildSafeUserOpTransaction(
      safe.address,
      await token.getAddress(),
      0,
      token.interface.encodeFunctionData('transfer', [user.address, await token.balanceOf(safe.address)]),
      await entryPoint.getNonce(safe.address, 0),
      await entryPoint.getAddress(),
    )
    const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
    const userOp = await buildRpcUserOperationFromSafeUserOperation({
      safeOp,
      signature,
    })

    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())

    await waitForUserOp(userOp)
    expect(await token.balanceOf(safe.address)).to.equal(0n)
    expect(await ethers.provider.getBalance(safe.address)).to.be.lessThan(ethers.parseEther('0.5'))
  })
})
