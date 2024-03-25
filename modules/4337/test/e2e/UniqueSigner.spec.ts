import { bundlerRpc, prepareAccounts, waitForUserOp } from '@safe-global/safe-4337-local-bundler'
import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { chainId } from '../utils/encoding'
import { packGasParameters, unpackUserOperation } from '../../src/utils/userOp'

describe('Unique Signers [@4337]', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { EntryPoint, Safe4337Module, SafeProxyFactory, SafeModuleSetup, SafeL2, MultiSend } = await deployments.run()
    const [user] = await prepareAccounts()
    const bundler = bundlerRpc()

    const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
    const module = await ethers.getContractAt('Safe4337Module', Safe4337Module.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const safeModuleSetup = await ethers.getContractAt('SafeModuleSetup', SafeModuleSetup.address)
    const singleton = await ethers.getContractAt('SafeL2', SafeL2.address)
    const multiSend = await ethers.getContractAt('MultiSend', MultiSend.address)

    const TestSafeSignerLaunchpad = await ethers.getContractFactory('TestSafeSignerLaunchpad')
    const signerLaunchpad = await TestSafeSignerLaunchpad.deploy(entryPoint)

    const TestUniqueSignerFactory = await ethers.getContractFactory('TestUniqueSignerFactory')
    const signerFactory = await TestUniqueSignerFactory.deploy()

    return {
      user,
      bundler,
      proxyFactory,
      safeModuleSetup,
      module,
      entryPoint,
      signerLaunchpad,
      singleton,
      multiSend,
      signerFactory,
    }
  })

  it('should execute a user op and deploy a unique signer', async () => {
    const { user, bundler, proxyFactory, safeModuleSetup, module, entryPoint, signerLaunchpad, singleton, signerFactory } =
      await setupTests()

    const key = BigInt(ethers.id('1'))
    const signerData = ethers.toBeHex(key, 32)
    const signer = await signerFactory.getSigner(signerData)

    const safeInit = {
      singleton: singleton.target,
      signerFactory: signerFactory.target,
      signerData,
      setupTo: safeModuleSetup.target,
      setupData: safeModuleSetup.interface.encodeFunctionData('enableModules', [[module.target]]),
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

    const launchpadInitializer = signerLaunchpad.interface.encodeFunctionData('preValidationSetup', [
      safeInitHash,
      ethers.ZeroAddress,
      '0x',
    ])
    const safeSalt = Date.now()
    const safe = await proxyFactory.createProxyWithNonce.staticCall(signerLaunchpad.target, launchpadInitializer, safeSalt)

    const packedUserOp = {
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
      preVerificationGas: ethers.toBeHex(60000),
      ...packGasParameters({
        verificationGasLimit: 500000,
        callGasLimit: 2000000,
        maxFeePerGas: 10000000000,
        maxPriorityFeePerGas: 10000000000,
      }),
      paymasterAndData: '0x',
    }

    const safeInitOp = {
      userOpHash: await entryPoint.getUserOpHash({ ...packedUserOp, signature: '0x' }),
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

    const userOp = await unpackUserOperation({ ...packedUserOp, signature })
    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())

    await waitForUserOp(userOp)
    expect(await ethers.provider.getBalance(safe)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    expect(await ethers.provider.getCode(safe)).to.not.equal('0x')

    const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
    expect(implementation).to.equal(singleton.target)

    const safeInstance = await ethers.getContractAt('SafeL2', safe)
    expect(await safeInstance.getOwners()).to.deep.equal([signer])
  })
})
