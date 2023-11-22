import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { buildSignatureBytes } from '../../src/utils/execution'
import { buildUserOperationFromSafeUserOperation, buildSafeUserOpTransaction, signSafeOp, UserOperation } from '../../src/utils/userOp'
import { chainId, timestamp } from '../utils/encoding'
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
    const { AddModulesLib, EntryPoint, HariWillibaldToken, MultiSend, Safe4337Module, SafeL2, SafeProxyFactory } = await deployments.run()
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

    const addModulesLib = await ethers.getContractAt('AddModulesLib', AddModulesLib.address)
    const multiSend = await ethers.getContractAt('MultiSend', MultiSend.address)
    const safeSingleton = await ethers.getContractAt('SafeL2', SafeL2.address)

    return {
      user,
      bundler,
      safe,
      validator,
      entryPoint,
      token,
      // TODO(nlordell): only needed for special test
      addModulesLib,
      multiSend,
      proxyFactory,
      safeSingleton,
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

  const waitForUserOp = async ({ sender, nonce }: Pick<UserOperation, 'sender' | 'nonce'>, timeout = 10_000) => {
    const { address: entryPointAddress } = await deployments.get('EntryPoint')
    const entryPoint = await ethers.getContractAt('INonceManager', entryPointAddress)
    const start = performance.now()
    const key = BigInt(nonce) >> 64n
    while ((await entryPoint.getNonce(sender, key)) <= BigInt(nonce)) {
      if (performance.now() - start > timeout) {
        throw new Error(`timeout waiting for user operation execution`)
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

    const nonce = await entryPoint.getNonce(safe.address, 0)
    const validAfter = (await timestamp()) - 60
    const validUntil = validAfter + 300
    const safeOp = buildSafeUserOpTransaction(
      safe.address,
      await token.getAddress(),
      0,
      token.interface.encodeFunctionData('transfer', [user.address, await token.balanceOf(safe.address)]),
      nonce,
      await entryPoint.getAddress(),
      false,
      false,
      validAfter,
      validUntil,
    )
    const signature = buildSignatureBytes(
      [await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())],
      validAfter,
      validUntil,
    )
    const userOp = buildUserOperationFromSafeUserOperation({
      safeAddress: safe.address,
      safeOp,
      signature,
      initCode: safe.getInitCode(),
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

    const nonce = await entryPoint.getNonce(safe.address, 0)
    const safeOp = buildSafeUserOpTransaction(
      safe.address,
      await token.getAddress(),
      0,
      token.interface.encodeFunctionData('transfer', [user.address, await token.balanceOf(safe.address)]),
      nonce,
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

    await waitForUserOp(userOp)
    expect(await token.balanceOf(safe.address)).to.equal(0n)
    expect(await ethers.provider.getBalance(safe.address)).to.be.lessThan(ethers.parseEther('0.5'))
  })

  // TODO(nlordell): This test is unrelated to the other two, and has vastly different setup, it
  // should go into its own module...
  it('should deploy a new Safe with alternate signing scheme accessing associated storage', async () => {
    const { user, bundler, validator, entryPoint, token, addModulesLib, multiSend, proxyFactory, safeSingleton } = await setupTests()

    const TestCustomSignerFactory = await ethers.getContractFactory('TestCustomSignerFactory')
    const signerFactory = await TestCustomSignerFactory.deploy()
    const signers = []
    for (let i = 0; i < 3; i++) {
      await signerFactory.deploySigner(i)
      signers.push(await ethers.getContractAt('TestCustomSigner', await signerFactory.getSigner(i)))
    }
    const keys = signers.map((_, i) => BigInt(ethers.keccak256(ethers.toBeHex(i, 1))))

    const TestStakedFactory = await ethers.getContractFactory('TestStakedFactory')
    const stakedFactory = await TestStakedFactory.deploy(proxyFactory.target)
    const stake = ethers.parseEther('1.0')
    await stakedFactory
      .stakeEntryPoint(await entryPoint.getAddress(), 0xffffffffn, {
        value: stake,
      })
      .then((tx) => tx.wait())

    const initData = multiSend.interface.encodeFunctionData('multiSend', [
      ethers.concat(
        [
          {
            op: 1,
            to: addModulesLib.target,
            data: addModulesLib.interface.encodeFunctionData('enableModules', [[validator.target]]),
          },
          ...signers.map((signer, i) => ({
            op: 0,
            to: signer.target,
            data: signer.interface.encodeFunctionData('setKey', [keys[i]]),
          })),
        ].map(({ op, to, data }) =>
          ethers.solidityPacked(['uint8', 'address', 'uint256', 'uint256', 'bytes'], [op, to, 0, ethers.dataLength(data), data]),
        ),
      ),
    ])
    const setupData = safeSingleton.interface.encodeFunctionData('setup', [
      signers.map((signer) => signer.target),
      signers.length,
      multiSend.target,
      initData,
      validator.target,
      ethers.ZeroAddress,
      0,
      ethers.ZeroAddress,
    ])
    const deployData = proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [safeSingleton.target, setupData, 0])
    const safeAddress = await proxyFactory.createProxyWithNonce.staticCall(safeSingleton.target, setupData, 0)
    const initCode = ethers.solidityPacked(['address', 'bytes'], [stakedFactory.target, deployData])

    await token.transfer(safeAddress, ethers.parseUnits('4.2', 18)).then((tx) => tx.wait())
    await user.sendTransaction({ to: safeAddress, value: ethers.parseEther('0.5') }).then((tx) => tx.wait())

    expect(ethers.dataLength(await ethers.provider.getCode(safeAddress))).to.equal(0)
    expect(await token.balanceOf(safeAddress)).to.equal(ethers.parseUnits('4.2', 18))

    const nonce = await entryPoint.getNonce(safeAddress, 0)
    const safeOp = buildSafeUserOpTransaction(
      safeAddress,
      await token.getAddress(),
      0,
      token.interface.encodeFunctionData('transfer', [user.address, await token.balanceOf(safeAddress)]),
      nonce,
      await entryPoint.getAddress(),
    )
    const opHash = await validator.getOperationHash(
      safeOp.safe,
      safeOp.callData,
      safeOp.nonce,
      safeOp.preVerificationGas,
      safeOp.verificationGasLimit,
      safeOp.callGasLimit,
      safeOp.maxFeePerGas,
      safeOp.maxPriorityFeePerGas,
      safeOp.signatureTimestamps,
      safeOp.entryPoint,
    )
    const signature = ethers.concat([
      buildSignatureBytes(
        signers.map((signer, i) => ({
          signer: signer.target as string,
          data: ethers.solidityPacked(['uint256', 'uint256', 'uint8'], [signer.target, 65 * signers.length + 64 * i, 0]),
        })),
      ),
      ...signers.map((_, i) => ethers.solidityPacked(['uint256', 'bytes'], [32, ethers.toBeHex(BigInt(opHash) ^ keys[i])])),
    ])
    const userOp = buildUserOperationFromSafeUserOperation({
      safeAddress: safeAddress,
      safeOp,
      signature,
      initCode,
    })

    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())

    await waitForUserOp(userOp)
    expect(ethers.dataLength(await ethers.provider.getCode(safeAddress))).to.not.equal(0)
    expect(await token.balanceOf(safeAddress)).to.equal(0)
    expect(await ethers.provider.getBalance(safeAddress)).to.be.lessThan(ethers.parseEther('0.5'))
  })
})
