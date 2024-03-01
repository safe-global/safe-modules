import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { buildSignatureBytes } from '../../src/utils/execution'
import { buildUserOperationFromSafeUserOperation, buildSafeUserOpTransaction } from '../../src/utils/userOp'
import { bundlerRpc, encodeMultiSendTransactions, prepareAccounts, waitForUserOp } from '../utils/e2e'

describe('E2E - Singleton Signers', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = async () => {
    const { SafeModuleSetup, EntryPoint, MultiSend, Safe4337Module, SafeL2, SafeProxyFactory } = await deployments.run()
    const [user] = await prepareAccounts()
    const bundler = bundlerRpc()

    const entryPoint = new ethers.Contract(EntryPoint.address, EntryPoint.abi, ethers.provider)
    const validator = await ethers.getContractAt('Safe4337Module', Safe4337Module.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const safeModuleSEtup = await ethers.getContractAt('SafeModuleSetup', SafeModuleSetup.address)
    const multiSend = await ethers.getContractAt('MultiSend', MultiSend.address)
    const safeSingleton = await ethers.getContractAt('SafeL2', SafeL2.address)

    const TestStakedFactory = await ethers.getContractFactory('TestStakedFactory')
    const stakedFactory = await TestStakedFactory.deploy(proxyFactory.target)
    const stake = ethers.parseEther('1.0')
    await stakedFactory
      .stakeEntryPoint(await entryPoint.getAddress(), 0xffffffffn, {
        value: stake,
      })
      .then((tx) => tx.wait())

    const TestSingletonSignerFactory = await ethers.getContractFactory('TestSingletonSignerFactory')
    const signerFactory = await TestSingletonSignerFactory.deploy()
    const customSigners = []
    for (let i = 0; i < 3; i++) {
      await signerFactory.deploySigner(i).then((tx) => tx.wait())
      customSigners.push({
        signer: await ethers.getContractAt('TestSingletonSigner', await signerFactory.getSigner(i)),
        key: BigInt(ethers.keccak256(ethers.toBeHex(i, 1))),
      })
    }

    return {
      user,
      bundler,
      validator,
      entryPoint,
      safeModuleSEtup,
      multiSend,
      proxyFactory,
      safeSingleton,
      stakedFactory,
      customSigners,
    }
  }

  it('should deploy a new Safe with alternate signing scheme accessing associated storage', async () => {
    const { user, bundler, validator, entryPoint, safeModuleSEtup, multiSend, proxyFactory, safeSingleton, stakedFactory, customSigners } =
      await setupTests()

    const initData = multiSend.interface.encodeFunctionData('multiSend', [
      encodeMultiSendTransactions([
        {
          op: 1,
          to: safeModuleSEtup.target,
          data: safeModuleSEtup.interface.encodeFunctionData('enableModules', [[validator.target]]),
        },
        ...customSigners.map(({ signer, key }) => ({
          op: 0 as const,
          to: signer.target,
          data: signer.interface.encodeFunctionData('setKey', [key]),
        })),
      ]),
    ])
    const setupData = safeSingleton.interface.encodeFunctionData('setup', [
      customSigners.map(({ signer }) => signer.target),
      customSigners.length,
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

    await user.sendTransaction({ to: safeAddress, value: ethers.parseEther('0.5') }).then((tx) => tx.wait())

    expect(ethers.dataLength(await ethers.provider.getCode(safeAddress))).to.equal(0)

    const safeOp = buildSafeUserOpTransaction(
      safeAddress,
      user.address,
      ethers.parseEther('0.1'),
      '0x',
      await entryPoint.getNonce(safeAddress, 0),
      await entryPoint.getAddress(),
      false,
      false,
      { initCode },
    )
    const opHash = await validator.getOperationHash(
      buildUserOperationFromSafeUserOperation({
        safeOp,
        signature: '0x',
      }),
    )
    const signature = buildSignatureBytes(
      customSigners.map(({ signer, key }) => ({
        signer: signer.target as string,
        data: ethers.toBeHex(BigInt(opHash) ^ key, 32),
        dynamic: true,
      })),
    )
    const userOp = buildUserOperationFromSafeUserOperation({
      safeOp,
      signature,
    })

    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())

    await waitForUserOp(userOp)
    expect(ethers.dataLength(await ethers.provider.getCode(safeAddress))).to.not.equal(0)
    expect(await ethers.provider.getBalance(safeAddress)).to.be.lessThan(ethers.parseEther('0.4'))
  })
})
