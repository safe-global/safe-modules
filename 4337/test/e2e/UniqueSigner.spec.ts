import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { bundlerRpc, encodeMultiSendTransactions, prepareAccounts, waitForUserOp } from '../utils/e2e'
import { chainId } from '../utils/encoding'

describe('E2E - Unique Signers', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { EntryPoint, Safe4337Module, SafeOpLaunchpad, SafeProxyFactory, AddModulesLib, SafeL2, MultiSend } = await deployments.run()
    const [user] = await prepareAccounts()
    const bundler = bundlerRpc()

    const entryPoint = await ethers.getContractAt('TestEntryPoint', EntryPoint.address)
    const module = await ethers.getContractAt('Safe4337Module', Safe4337Module.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const addModulesLib = await ethers.getContractAt('AddModulesLib', AddModulesLib.address)
    const launchpad = await ethers.getContractAt('SafeOpLaunchpad', SafeOpLaunchpad.address)
    const singleton = await ethers.getContractAt('SafeL2', SafeL2.address)
    const multiSend = await ethers.getContractAt('MultiSend', MultiSend.address)

    const TestUniqueSignerFactory = await ethers.getContractFactory('TestUniqueSignerFactory')
    const signerFactory = await TestUniqueSignerFactory.deploy()

    return {
      user,
      bundler,
      proxyFactory,
      addModulesLib,
      module,
      entryPoint,
      launchpad,
      singleton,
      multiSend,
      signerFactory,
    }
  })

  function dataOffset(source: string, needle: string): number {
    for (let i = 0; i < ethers.dataLength(source); i++) {
      if (ethers.dataSlice(source, i).slice(0, needle.length) == needle) {
        return i
      }
    }
    return -1
  }

  it('should execute the user op with deferred initialization', async () => {
    const { user, bundler, proxyFactory, addModulesLib, module, entryPoint, launchpad, singleton, multiSend, signerFactory } =
      await setupTests()

    const key = BigInt(ethers.id('1'))
    const signer = await signerFactory.getSigner(key)

    const safeInit = {
      singleton: singleton.target,
      initializer: singleton.interface.encodeFunctionData('setup', [
        [signer],
        1,
        multiSend.target,
        multiSend.interface.encodeFunctionData('multiSend', [
          encodeMultiSendTransactions([
            {
              op: 1,
              to: addModulesLib.target,
              data: addModulesLib.interface.encodeFunctionData('enableModules', [[module.target]]),
            },
            {
              op: 0 as const,
              to: signerFactory.target,
              data: signerFactory.interface.encodeFunctionData('deploySigner', [key]),
            },
          ]),
        ]),
        module.target,
        ethers.ZeroAddress,
        0,
        ethers.ZeroAddress,
      ]),
      nonce: 0,
      initCodeTemplate: ethers.solidityPacked(
        ['address', 'bytes'],
        [
          proxyFactory.target,
          proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [
            launchpad.target,
            launchpad.interface.encodeFunctionData('setup', [ethers.ZeroHash, ethers.ZeroAddress, '0x']),
            0,
          ]),
        ],
      ),
      callGasLimit: 2000000,
      verificationGasLimit: 500000,
      preVerificationGas: 60000,
      maxFeePerGas: 10000000000,
      maxPriorityFeePerGas: 10000000000,
      paymasterAndData: '0x',
      validAfter: 0,
      validUntil: 0,
      entryPoint: entryPoint.target,
    }
    const safeInitTypes = {
      SafeInit: [
        { type: 'address', name: 'singleton' },
        { type: 'bytes', name: 'initializer' },
        { type: 'uint256', name: 'nonce' },
        { type: 'bytes', name: 'initCodeTemplate' },
        { type: 'uint256', name: 'callGasLimit' },
        { type: 'uint256', name: 'verificationGasLimit' },
        { type: 'uint256', name: 'preVerificationGas' },
        { type: 'uint256', name: 'maxFeePerGas' },
        { type: 'uint256', name: 'maxPriorityFeePerGas' },
        { type: 'bytes', name: 'paymasterAndData' },
        { type: 'uint48', name: 'validAfter' },
        { type: 'uint48', name: 'validUntil' },
        { type: 'address', name: 'entryPoint' },
      ],
    }
    const safeInitHash = ethers.TypedDataEncoder.hashStruct('SafeInit', safeInitTypes, safeInit)

    const launchpadInitializer = launchpad.interface.encodeFunctionData('setup', [safeInitHash, ethers.ZeroAddress, '0x'])
    const safe = await proxyFactory.createProxyWithNonce.staticCall(launchpad.target, launchpadInitializer, 0)
    const initCode = ethers.solidityPacked(
      ['address', 'bytes'],
      [proxyFactory.target, proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [launchpad.target, launchpadInitializer, 0])],
    )

    const safeInitOp = {
      init: safeInit,
      safe,
      callData: module.interface.encodeFunctionData('executeUserOp', [user.address, ethers.parseEther('0.5'), '0x', 0]),
    }
    const safeInitOpTypes = {
      ...safeInitTypes,
      SafeInitOp: [
        { type: 'SafeInit', name: 'init' },
        { type: 'address', name: 'safe' },
        { type: 'bytes', name: 'callData' },
      ],
    }
    const safeInitOpHash = ethers.TypedDataEncoder.hash(
      { verifyingContract: await launchpad.getAddress(), chainId: await chainId() },
      safeInitOpTypes,
      safeInitOp,
    )

    const userOp = {
      sender: safe,
      nonce: ethers.toBeHex(safeInit.nonce),
      initCode,
      callData: launchpad.interface.encodeFunctionData('initializeThenUserOp', [
        safeInit.singleton,
        safeInit.initializer,
        safeInitOp.callData,
        ethers.solidityPacked(['uint256', 'uint256', 'uint8', 'uint256', 'uint256'], [signer, 65, 0, 32, key ^ BigInt(safeInitOpHash)]),
      ]),
      callGasLimit: ethers.toBeHex(safeInit.callGasLimit),
      verificationGasLimit: ethers.toBeHex(safeInit.verificationGasLimit),
      preVerificationGas: ethers.toBeHex(safeInit.preVerificationGas),
      maxFeePerGas: ethers.toBeHex(safeInit.maxFeePerGas),
      maxPriorityFeePerGas: ethers.toBeHex(safeInit.maxPriorityFeePerGas),
      paymasterAndData: safeInit.paymasterAndData,
      signature: ethers.solidityPacked(
        ['uint48', 'uint48', 'uint32'],
        [safeInit.validAfter, safeInit.validUntil, dataOffset(ethers.dataSlice(initCode, 20), safeInitHash)],
      ),
    }
    expect(await launchpad.getInitHash(userOp)).to.equal(safeInitHash)

    await user.sendTransaction({ to: safe, value: ethers.parseEther('1') }).then((tx) => tx.wait())
    expect(await ethers.provider.getBalance(safe)).to.equal(ethers.parseEther('1'))
    expect(await ethers.provider.getCode(safe)).to.equal('0x')

    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())

    await waitForUserOp(userOp)
    expect(await ethers.provider.getBalance(safe)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    expect(await ethers.provider.getCode(safe)).to.not.equal('0x')

    const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
    expect(implementation).to.equal(singleton.target)
  })
})
