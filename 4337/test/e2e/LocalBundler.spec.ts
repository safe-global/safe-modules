import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { buildSignatureBytes } from '../../src/utils/execution'
import { buildUserOperationFromSafeUserOperation, buildSafeUserOpTransaction, signSafeOp } from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { MultiProvider4337, Safe4337 } from '../../src/utils/safe'

const BUNDLER_URL = process.env.TEST_BUNLDER_URL ?? 'http://localhost:3000/rpc'
const BUNDLER_MNEMONIC = process.env.TEST_BUNDLER_MNEMONIC ?? 'test test test test test test test test test test test junk'

describe('E2E - Local Bundler', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = async () => {
    const { AddModulesLib, EntryPoint, HariWillibaldToken, Safe4337Module, SafeL2, SafeProxyFactory } = await deployments.run()
    const [, user] = await prepareAccounts()
    const bundler = bundlerRpc()

    const entryPoint = new ethers.Contract(EntryPoint.address, EntryPoint.abi, ethers.provider)
    const validator = await ethers.getContractAt('Safe4337Module', Safe4337Module.address)
    const token = await ethers.getContractAt('HariWillibaldToken', HariWillibaldToken.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const proxyCreationCode = await proxyFactory.proxyCreationCode()

    const safe = await Safe4337.withConfigs(
      {
        signers: [user.address],
        threshold: 1,
        nonce: ~~(Math.random() * 0x7fffffff),
      },
      {
        safeSingleton: SafeL2.address,
        entryPoint: EntryPoint.address,
        erc4337module: Safe4337Module.address,
        proxyFactory: SafeProxyFactory.address,
        addModulesLib: AddModulesLib.address,
        proxyCreationCode,
        chainId: Number(await chainId()),
      },
    )

    return {
      user,
      bundler,
      safe,
      validator,
      entryPoint,
      token,
    }
  }

  const prepareAccounts = async (mnemonic = BUNDLER_MNEMONIC, count = 2) => {
    const accounts = [...Array(count)].map((_, i) =>
      ethers.HDNodeWallet.fromPhrase(mnemonic, '', ethers.getIndexedAccountPath(i)).connect(ethers.provider),
    )

    const [deployer] = await ethers.getSigners()
    const fund = ethers.parseEther('1.337')
    for (const account of accounts) {
      const balance = await ethers.provider.getBalance(account.address)
      if (balance < fund) {
        const transaction = await deployer.sendTransaction({ to: account.address, value: fund })
        await transaction.wait()
      }
    }

    return accounts
  }

  const bundlerRpc = (url = BUNDLER_URL) => {
    return new MultiProvider4337(url, ethers.provider)
  }

  const waitFor = async (name: string, predicate: () => Promise<boolean>, timeout = 10_000) => {
    const start = performance.now()
    while (!(await predicate())) {
      if (performance.now() - start > timeout) {
        throw new Error(`timeout waiting for ${name}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  it('should deploy a new Safe and execute a transaction', async () => {
    const { user, bundler, safe, validator, entryPoint, token } = await setupTests()

    await token.transfer(safe.address, ethers.parseUnits('4.2', 18)).then((tx) => tx.wait())
    await user.sendTransaction({ to: safe.address, value: ethers.parseEther('0.5') }).then((tx) => tx.wait())

    expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)
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
    const userOp = buildUserOperationFromSafeUserOperation({
      safeAddress: safe.address,
      safeOp,
      signature,
      initCode: safe.getInitCode(),
    })

    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())

    await waitFor('user operation to execute', async () => (await token.balanceOf(safe.address)) == 0n)
    expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)
    expect(await ethers.provider.getBalance(safe.address)).to.be.lessThan(ethers.parseEther('0.5'))
  })

  it('should execute a transaction for an exsiting Safe', async () => {
    const { user, bundler, safe, validator, entryPoint, token } = await setupTests()

    const initCode = safe.getInitCode()
    const factory = ethers.getAddress(ethers.dataSlice(initCode, 0, 20))
    const initCallData = ethers.dataSlice(initCode, 20)
    await user.sendTransaction({ to: factory, data: initCallData }).then((tx) => tx.wait())

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
    const userOp = buildUserOperationFromSafeUserOperation({
      safeAddress: safe.address,
      safeOp,
      signature,
      initCode: '0x',
    })

    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())

    await waitFor('user operation to execute', async () => (await token.balanceOf(safe.address)) == 0n)
    expect(await ethers.provider.getBalance(safe.address)).to.be.lessThan(ethers.parseEther('0.5'))
  })
})
