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
    const { EntryPoint, Safe4337Module, SafeOpLaunchpad, SafeSignerLaunchpad, SafeProxyFactory, AddModulesLib, SafeL2, MultiSend } =
      await deployments.run()
    const [user] = await prepareAccounts()
    const bundler = bundlerRpc()

    const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
    const module = await ethers.getContractAt('Safe4337Module', Safe4337Module.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const addModulesLib = await ethers.getContractAt('AddModulesLib', AddModulesLib.address)
    const opLaunchpad = await ethers.getContractAt('SafeOpLaunchpad', SafeOpLaunchpad.address)
    const signerLaunchpad = await ethers.getContractAt('SafeSignerLaunchpad', SafeSignerLaunchpad.address)
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
      opLaunchpad,
      signerLaunchpad,
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

  it('should execute a user op with deferred initialization', async () => {
    const { user, bundler, proxyFactory, addModulesLib, module, entryPoint, opLaunchpad, singleton, multiSend, signerFactory } =
      await setupTests()

    const key = BigInt(ethers.id('1'))
    const signer = await signerFactory.getSigner(ethers.toBeHex(key, 32))

    const safeInit = {
      nonce: 0,
      initCodeTemplate: ethers.solidityPacked(
        ['address', 'bytes'],
        [
          proxyFactory.target,
          proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [
            opLaunchpad.target,
            opLaunchpad.interface.encodeFunctionData('setup', [ethers.ZeroHash, ethers.ZeroAddress, '0x']),
            0,
          ]),
        ],
      ),
      callData: opLaunchpad.interface.encodeFunctionData('initializeThenUserOp', [
        singleton.target,
        singleton.interface.encodeFunctionData('setup', [
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
                data: signerFactory.interface.encodeFunctionData('createSigner', [ethers.toBeHex(key, 32)]),
              },
            ]),
          ]),
          module.target,
          ethers.ZeroAddress,
          0,
          ethers.ZeroAddress,
        ]),
        module.interface.encodeFunctionData('executeUserOp', [user.address, ethers.parseEther('0.5'), '0x', 0]),
      ]),
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
    const safeInitHash = ethers.TypedDataEncoder.hash(
      { verifyingContract: await opLaunchpad.getAddress(), chainId: await chainId() },
      {
        SafeInit: [
          { type: 'uint256', name: 'nonce' },
          { type: 'bytes', name: 'initCodeTemplate' },
          { type: 'bytes', name: 'callData' },
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
      },
      safeInit,
    )

    const launchpadInitializer = opLaunchpad.interface.encodeFunctionData('setup', [safeInitHash, ethers.ZeroAddress, '0x'])
    const safe = await proxyFactory.createProxyWithNonce.staticCall(opLaunchpad.target, launchpadInitializer, 0)
    const initCode = ethers.solidityPacked(
      ['address', 'bytes'],
      [
        proxyFactory.target,
        proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [opLaunchpad.target, launchpadInitializer, 0]),
      ],
    )

    const userOp = {
      sender: safe,
      nonce: ethers.toBeHex(safeInit.nonce),
      initCode,
      callData: safeInit.callData,
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
    expect(await opLaunchpad.getInitHash(userOp)).to.equal(safeInitHash)

    await user.sendTransaction({ to: safe, value: ethers.parseEther('1') }).then((tx) => tx.wait())
    expect(await ethers.provider.getBalance(safe)).to.equal(ethers.parseEther('1'))
    expect(await ethers.provider.getCode(safe)).to.equal('0x')

    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())

    await waitForUserOp(userOp)
    expect(await ethers.provider.getBalance(safe)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    expect(await ethers.provider.getCode(safe)).to.not.equal('0x')

    const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
    expect(implementation).to.equal(singleton.target)

    const safeInstance = await ethers.getContractAt('SafeL2', safe)
    expect(await safeInstance.getOwners()).to.deep.equal([signer])
  })

  it('should execute a user op and deploy a unique signer', async () => {
    const { user, bundler, proxyFactory, addModulesLib, module, entryPoint, signerLaunchpad, singleton, signerFactory } = await setupTests()

    const key = BigInt(ethers.id('1'))
    const signerData = ethers.toBeHex(key, 32)
    const signer = await signerFactory.getSigner(signerData)

    const safeInit = {
      singleton: singleton.target,
      signerFactory: signerFactory.target,
      signerData,
      setupTo: addModulesLib.target,
      setupData: addModulesLib.interface.encodeFunctionData('enableModules', [[module.target]]),
      fallbackHandler: module.target,
    }
    const safeInitHash = ethers.TypedDataEncoder.hash(
      { verifyingContract: await signerLaunchpad.getAddress(), chainId: await chainId() },
      {
        SafeInit: [
          { type: 'address', name: 'singleton' },
          { type: 'address', name: 'signerFactory' },
          { type: 'bytes', name: 'signerData' },
          { type: 'address', name: 'setupTo' },
          { type: 'bytes', name: 'setupData' },
          { type: 'address', name: 'fallbackHandler' },
        ],
      },
      safeInit,
    )

    expect(
      await signerLaunchpad.getInitHash(
        safeInit.singleton,
        safeInit.signerFactory,
        safeInit.signerData,
        safeInit.setupTo,
        safeInit.setupData,
        safeInit.fallbackHandler,
      ),
    ).to.equal(safeInitHash)

    const launchpadInitializer = signerLaunchpad.interface.encodeFunctionData('setup', [safeInitHash, ethers.ZeroAddress, '0x'])
    const safeSalt = Date.now()
    const safe = await proxyFactory.createProxyWithNonce.staticCall(signerLaunchpad.target, launchpadInitializer, safeSalt)

    const userOp = {
      sender: safe,
      nonce: ethers.toBeHex(await entryPoint.getNonce(safe, 0)),
      initCode: ethers.solidityPacked(
        ['address', 'bytes'],
        [
          proxyFactory.target,
          proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [signerLaunchpad.target, launchpadInitializer, safeSalt]),
        ],
      ),
      callData: signerLaunchpad.interface.encodeFunctionData('initializeThenUserOp', [
        safeInit.singleton,
        safeInit.signerFactory,
        safeInit.signerData,
        safeInit.setupTo,
        safeInit.setupData,
        safeInit.fallbackHandler,
        module.interface.encodeFunctionData('executeUserOp', [user.address, ethers.parseEther('0.5'), '0x', 0]),
      ]),
      callGasLimit: ethers.toBeHex(2000000),
      verificationGasLimit: ethers.toBeHex(500000),
      preVerificationGas: ethers.toBeHex(60000),
      maxFeePerGas: ethers.toBeHex(10000000000),
      maxPriorityFeePerGas: ethers.toBeHex(10000000000),
      paymasterAndData: '0x',
    }

    const safeInitOp = {
      userOpHash: await entryPoint.getUserOpHash({ ...userOp, signature: '0x' }),
      validAfter: 0,
      validUntil: 0,
      entryPoint: entryPoint.target,
    }
    const safeInitOpHash = ethers.TypedDataEncoder.hash(
      { verifyingContract: await signerLaunchpad.getAddress(), chainId: await chainId() },
      {
        SafeInitOp: [
          { type: 'bytes32', name: 'userOpHash' },
          { type: 'uint48', name: 'validAfter' },
          { type: 'uint48', name: 'validUntil' },
          { type: 'address', name: 'entryPoint' },
        ],
      },
      safeInitOp,
    )

    const signature = ethers.solidityPacked(
      ['uint48', 'uint48', 'bytes'],
      [safeInitOp.validAfter, safeInitOp.validUntil, ethers.toBeHex(BigInt(safeInitOpHash) ^ key, 32)],
    )

    await user.sendTransaction({ to: safe, value: ethers.parseEther('1') }).then((tx) => tx.wait())
    expect(await ethers.provider.getBalance(safe)).to.equal(ethers.parseEther('1'))
    expect(await ethers.provider.getCode(safe)).to.equal('0x')

    await bundler.sendUserOperation({ ...userOp, signature }, await entryPoint.getAddress())

    await waitForUserOp(userOp)
    expect(await ethers.provider.getBalance(safe)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    expect(await ethers.provider.getCode(safe)).to.not.equal('0x')

    const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
    expect(implementation).to.equal(singleton.target)

    const safeInstance = await ethers.getContractAt('SafeL2', safe)
    expect(await safeInstance.getOwners()).to.deep.equal([signer])
  })
})
