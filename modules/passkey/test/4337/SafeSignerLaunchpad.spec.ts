import { setBalance } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import { SafeSignerLaunchpad, PackedUserOperationStruct } from '../../typechain-types/contracts/4337/SafeSignerLaunchpad'
import * as ERC1271 from '../utils/erc1271'

describe('SafeSignerLaunchpad', () => {
  const setupTests = deployments.createFixture(async () => {
    const { EntryPoint, SafeSignerLaunchpad, SafeProxyFactory, SafeL2, MultiSend } = await deployments.run()

    const safeSingleton = await ethers.getContractAt(SafeL2.abi, SafeL2.address)
    const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const signerLaunchpad = await ethers.getContractAt('SafeSignerLaunchpad', SafeSignerLaunchpad.address)
    const multiSend = await ethers.getContractAt('MultiSend', MultiSend.address)

    const entryPointImpersonator = await ethers.getImpersonatedSigner(EntryPoint.address)
    await setBalance(EntryPoint.address, ethers.parseEther('100'))

    const deployProxyWithoutSetup = async () => {
      const proxy = await ethers.getContractAt(
        'SafeSignerLaunchpad',
        await proxyFactory.createProxyWithNonce.staticCall(signerLaunchpad, '0x', 0),
      )
      await proxyFactory.createProxyWithNonce(signerLaunchpad, '0x', 0)
      return proxy
    }

    const MockContract = await ethers.getContractFactory('MockContract')
    const mockSignerFactory = await MockContract.deploy()
    const mockSigner = await MockContract.deploy()
    const defaultParams = {
      singleton: safeSingleton,
      signerFactory: await ethers.getContractAt('ISafeSignerFactory', mockSignerFactory),
      signerX: ethers.id('publicKey.x'),
      signerY: ethers.id('publicKey.y'),
      signerVerifiers: ethers.dataSlice(ethers.id('verifiers'), 0, 22),
      initializer: ethers.ZeroAddress,
      initializerData: '0x',
      fallbackHandler: ethers.ZeroAddress,
    }
    const deployDefaultProxy = async () => {
      const setup = signerLaunchpad.interface.encodeFunctionData('setup', [
        await defaultParams.singleton.getAddress(),
        await defaultParams.signerFactory.getAddress(),
        defaultParams.signerX,
        defaultParams.signerY,
        defaultParams.signerVerifiers,
        defaultParams.initializer,
        defaultParams.initializerData,
        defaultParams.fallbackHandler,
      ])
      await mockSignerFactory.givenCalldataReturnAddress(
        defaultParams.signerFactory.interface.encodeFunctionData('getSigner', [
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
        ]),
        mockSigner,
      )
      const proxy = await ethers.getContractAt(
        'SafeSignerLaunchpad',
        await proxyFactory.createProxyWithNonce.staticCall(signerLaunchpad, setup, 0),
      )
      await proxyFactory.createProxyWithNonce(signerLaunchpad, setup, 0)
      return proxy
    }

    async function getUserOp(proxy: SafeSignerLaunchpad, overrides: Partial<PackedUserOperationStruct> = {}) {
      return {
        sender: await proxy.getAddress(),
        nonce: await entryPoint.getNonce(proxy, 0),
        initCode: '0x',
        callData: proxy.interface.encodeFunctionData('promoteAccountAndExecuteUserOp', [
          await defaultParams.signerFactory.getAddress(),
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
          ethers.ZeroAddress,
          0,
          '0x',
          0,
        ]),
        accountGasLimits: `0x${'01'.repeat(16)}${'02'.repeat(16)}`,
        preVerificationGas: `0x${'03'.repeat(16)}`,
        gasFees: `0x${'04'.repeat(16)}${'05'.repeat(16)}`,
        paymasterAndData: `0x01020304`,
        signature: `0x`,
        ...overrides,
      }
    }

    return {
      safeSingleton,
      multiSend,
      entryPoint,
      entryPointImpersonator,
      proxyFactory,
      signerLaunchpad,
      deployProxyWithoutSetup,
      mockSignerFactory,
      mockSigner,
      defaultParams,
      deployDefaultProxy,
      getUserOp,
    }
  })

  describe('constructor', function () {
    it('Should set immutables', async () => {
      const { entryPoint, signerLaunchpad } = await setupTests()

      expect(await signerLaunchpad.SUPPORTED_ENTRYPOINT()).to.equal(entryPoint.target)
    })

    it('Should revert on invalid EntryPoint', async () => {
      const SafeSignerLaunchpad = await ethers.getContractFactory('SafeSignerLaunchpad')
      await expect(SafeSignerLaunchpad.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(SafeSignerLaunchpad, 'InvalidEntryPoint')
    })
  })

  describe('receive', function () {
    it('Should accept Ether transfers', async () => {
      const { deployProxyWithoutSetup } = await setupTests()

      const proxy = await deployProxyWithoutSetup()

      await expect(proxy.fallback!({ value: ethers.parseEther('1') })).to.not.be.reverted
      expect(await ethers.provider.getBalance(proxy)).to.equal(ethers.parseEther('1'))
    })

    it('Should revert if transferred to the singleton directly', async () => {
      const { signerLaunchpad } = await setupTests()

      await expect(signerLaunchpad.fallback!({ value: ethers.parseEther('1') })).to.be.revertedWithCustomError(
        signerLaunchpad,
        'NotProxied',
      )
    })
  })

  describe('setup', function () {
    it('Should setup the proxy account', async () => {
      const { deployProxyWithoutSetup, mockSignerFactory, defaultParams, safeSingleton } = await setupTests()

      const signer = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)))
      await mockSignerFactory.givenCalldataReturnAddress(
        defaultParams.signerFactory.interface.encodeFunctionData('getSigner', [
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
        ]),
        signer,
      )

      const proxy = await deployProxyWithoutSetup()
      await expect(
        proxy.setup(
          defaultParams.singleton,
          defaultParams.signerFactory,
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
          defaultParams.initializer,
          defaultParams.initializerData,
          defaultParams.fallbackHandler,
        ),
      )
        .to.emit(safeSingleton.attach(await proxy.getAddress()), 'SafeSetup')
        .withArgs(await proxy.getAddress(), [signer], 1, defaultParams.initializer, defaultParams.fallbackHandler)
    })

    it('Should revert on invalid singleton address', async () => {
      const { deployProxyWithoutSetup, defaultParams } = await setupTests()

      const proxy = await deployProxyWithoutSetup()
      await expect(
        proxy.setup(
          ethers.ZeroAddress,
          defaultParams.signerFactory,
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
          defaultParams.initializer,
          defaultParams.initializerData,
          defaultParams.fallbackHandler,
        ),
      ).to.revertedWithCustomError(proxy, 'InvalidSingleton')
    })

    it('Should revert if already set up', async () => {
      const { deployDefaultProxy } = await setupTests()

      const proxy = await deployDefaultProxy()
      await expect(
        proxy.setup(ethers.ZeroAddress, ethers.ZeroAddress, 0, 0, 0, ethers.ZeroAddress, '0x', ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(proxy, 'AlreadyInitialized')
    })

    it('Should revert if threshold is not exactly 1 after setup', async () => {
      const { deployProxyWithoutSetup, mockSignerFactory, defaultParams } = await setupTests()

      const signer = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)))
      await mockSignerFactory.givenCalldataReturnAddress(
        defaultParams.signerFactory.interface.encodeFunctionData('getSigner', [
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
        ]),
        signer,
      )

      const MockContract = await ethers.getContractFactory('MockContract')
      const mockSingleton = await MockContract.deploy()
      await mockSingleton.givenAnyReturnBool(true)

      const proxy = await deployProxyWithoutSetup()
      await expect(
        proxy.setup(
          mockSingleton,
          defaultParams.signerFactory,
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
          defaultParams.initializer,
          defaultParams.initializerData,
          defaultParams.fallbackHandler,
        ),
      ).to.revertedWithCustomError(proxy, 'InvalidThreshold')
    })

    it('Should revert if called to the singleton directly', async () => {
      const { signerLaunchpad } = await setupTests()

      await expect(
        signerLaunchpad.setup(ethers.ZeroAddress, ethers.ZeroAddress, 0, 0, 0, ethers.ZeroAddress, '0x', ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(signerLaunchpad, 'NotProxied')
    })
  })

  describe('domainSeparator', function () {
    it('Should return the correct domain separator hash', async () => {
      const { deployDefaultProxy, signerLaunchpad } = await setupTests()

      const { chainId } = await ethers.provider.getNetwork()
      const proxy = await deployDefaultProxy()

      expect(await proxy.domainSeparator()).to.equal(
        ethers.TypedDataEncoder.hashDomain({
          chainId,
          verifyingContract: await signerLaunchpad.getAddress(),
        }),
      )
    })
  })

  describe('getOperationHash', function () {
    it('Should return the correct operation hash', async () => {
      const { deployDefaultProxy, entryPoint, signerLaunchpad } = await setupTests()

      const { chainId } = await ethers.provider.getNetwork()
      const proxy = await deployDefaultProxy()

      const userOpHash = ethers.randomBytes(32)
      const validAfter = 0x010203040506
      const validUntil = 0x060504030201

      expect(await proxy.getOperationHash(userOpHash, validAfter, validUntil)).to.equal(
        ethers.TypedDataEncoder.hash(
          {
            chainId,
            verifyingContract: await signerLaunchpad.getAddress(),
          },
          {
            SafeInitOp: [
              { name: 'userOpHash', type: 'bytes32' },
              { name: 'validAfter', type: 'uint48' },
              { name: 'validUntil', type: 'uint48' },
              { name: 'entryPoint', type: 'address' },
            ],
          },
          {
            userOpHash,
            validAfter,
            validUntil,
            entryPoint: await entryPoint.getAddress(),
          },
        ),
      )
    })
  })

  describe('validateUserOp', function () {
    it('Should return valid result when signature is verified', async () => {
      const { deployDefaultProxy, getUserOp, entryPoint, entryPointImpersonator, mockSignerFactory, mockSigner, defaultParams } =
        await setupTests()

      const proxy = await deployDefaultProxy()

      const userOp = await getUserOp(proxy)
      const validAfter = 0x010203040506
      const validUntil = 0x060504030201

      const userOpHash = await entryPoint.getUserOpHash(userOp)
      const safeInitHash = await proxy.getOperationHash(userOpHash, validAfter, validUntil)
      const signature = ethers.randomBytes(42)

      await mockSignerFactory.givenCalldataReturnAddress(
        defaultParams.signerFactory.interface.encodeFunctionData('getSigner', [
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
        ]),
        mockSigner,
      )
      await mockSignerFactory.givenCalldataReturnBytes32(
        defaultParams.signerFactory.interface.encodeFunctionData('isValidSignatureForSigner', [
          safeInitHash,
          signature,
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
        ]),
        ethers.AbiCoder.defaultAbiCoder().encode(['bytes4'], [ERC1271.MAGIC_VALUE]),
      )

      expect(
        await proxy.connect(entryPointImpersonator).validateUserOp.staticCall(
          {
            ...userOp,
            signature: ethers.solidityPacked(['uint48', 'uint48', 'bytes'], [validAfter, validUntil, signature]),
          },
          userOpHash,
          0,
        ),
      ).to.equal(ethers.solidityPacked(['uint48', 'uint48', 'address'], [validAfter, validUntil, ethers.ZeroAddress]))
    })

    it('Should transfer pre-fund if specified', async () => {
      const { deployDefaultProxy, getUserOp, entryPoint, entryPointImpersonator, mockSignerFactory, mockSigner, defaultParams } =
        await setupTests()

      const proxy = await deployDefaultProxy()

      const userOp = await getUserOp(proxy, { signature: `0x${'00'.repeat(12)}` })
      const userOpHash = await entryPoint.getUserOpHash(userOp)
      const preFund = ethers.parseEther('1')

      await mockSignerFactory.givenMethodReturnAddress(defaultParams.signerFactory.interface.getFunction('getSigner').selector, mockSigner)
      await mockSignerFactory.givenMethodReturnBytes32(
        defaultParams.signerFactory.interface.getFunction('isValidSignatureForSigner').selector,
        ethers.AbiCoder.defaultAbiCoder().encode(['bytes4'], [ERC1271.MAGIC_VALUE]),
      )

      const balanceBefore = await ethers.provider.getBalance(entryPoint)

      await setBalance(await proxy.getAddress(), preFund)
      expect(await proxy.connect(entryPointImpersonator).validateUserOp.staticCall(userOp, userOpHash, preFund)).to.equal(0)
      const transactionReceipt = await proxy
        .connect(entryPointImpersonator)
        .validateUserOp(userOp, userOpHash, preFund)
        .then((tx) => tx.wait())

      expect(await ethers.provider.getBalance(proxy)).to.equal(0)
      expect(await ethers.provider.getBalance(entryPoint)).to.equal(
        balanceBefore + preFund - transactionReceipt!.gasUsed * transactionReceipt!.gasPrice,
      )
    })

    it('Should transfer pre-fund even on invalid signature', async () => {
      const { deployDefaultProxy, getUserOp, entryPoint, entryPointImpersonator, mockSignerFactory, mockSigner, defaultParams } =
        await setupTests()

      const proxy = await deployDefaultProxy()

      const userOp = await getUserOp(proxy, { signature: `0x${'00'.repeat(12)}` })
      const userOpHash = await entryPoint.getUserOpHash(userOp)
      const preFund = ethers.parseEther('1')

      await mockSignerFactory.givenMethodReturnAddress(defaultParams.signerFactory.interface.getFunction('getSigner').selector, mockSigner)
      await mockSignerFactory.givenMethodReturnBytes32(
        defaultParams.signerFactory.interface.getFunction('isValidSignatureForSigner').selector,
        ethers.ZeroHash,
      )

      const balanceBefore = await ethers.provider.getBalance(entryPoint)

      await setBalance(await proxy.getAddress(), preFund)
      expect(await proxy.connect(entryPointImpersonator).validateUserOp.staticCall(userOp, userOpHash, preFund)).to.equal(1)
      const transactionReceipt = await proxy
        .connect(entryPointImpersonator)
        .validateUserOp(userOp, userOpHash, preFund)
        .then((tx) => tx.wait())

      expect(await ethers.provider.getBalance(proxy)).to.equal(0)
      expect(await ethers.provider.getBalance(entryPoint)).to.equal(
        balanceBefore + preFund - transactionReceipt!.gasUsed * transactionReceipt!.gasPrice,
      )
    })

    it('Should return invalid result if signer is not an owner', async () => {
      const { deployDefaultProxy, getUserOp, entryPoint, entryPointImpersonator, mockSignerFactory, defaultParams } = await setupTests()

      const proxy = await deployDefaultProxy()

      const userOp = await getUserOp(proxy, {
        callData: proxy.interface.encodeFunctionData('promoteAccountAndExecuteUserOp', [
          await defaultParams.signerFactory.getAddress(),
          BigInt(defaultParams.signerX) + 1n,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
          ethers.ZeroAddress,
          0,
          '0x',
          0,
        ]),
        signature: `0x${'00'.repeat(12)}`,
      })
      const userOpHash = await entryPoint.getUserOpHash(userOp)

      const otherSigner = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)))
      await mockSignerFactory.givenMethodReturnAddress(defaultParams.signerFactory.interface.getFunction('getSigner').selector, otherSigner)
      await mockSignerFactory.givenMethodReturnBytes32(
        defaultParams.signerFactory.interface.getFunction('isValidSignatureForSigner').selector,
        ethers.AbiCoder.defaultAbiCoder().encode(['bytes4'], [ERC1271.MAGIC_VALUE]),
      )

      expect(await proxy.connect(entryPointImpersonator).validateUserOp.staticCall(userOp, userOpHash, 0)).to.equal(1)
    })

    it('Should return invalid result if signature verification fails', async () => {
      const { deployDefaultProxy, getUserOp, entryPoint, entryPointImpersonator, mockSignerFactory, mockSigner, defaultParams } =
        await setupTests()

      const proxy = await deployDefaultProxy()

      const userOp = await getUserOp(proxy, { signature: `0x${'00'.repeat(12)}` })
      const userOpHash = await entryPoint.getUserOpHash(userOp)

      await mockSignerFactory.givenMethodReturnAddress(defaultParams.signerFactory.interface.getFunction('getSigner').selector, mockSigner)
      await mockSignerFactory.givenMethodReturnBytes32(
        defaultParams.signerFactory.interface.getFunction('isValidSignatureForSigner').selector,
        ethers.ZeroHash,
      )

      expect(await proxy.connect(entryPointImpersonator).validateUserOp.staticCall(userOp, userOpHash, 0)).to.equal(1)
    })

    it('Should return invalid result if signature verification reverts', async () => {
      const { deployDefaultProxy, getUserOp, entryPoint, entryPointImpersonator, mockSignerFactory, mockSigner, defaultParams } =
        await setupTests()

      const proxy = await deployDefaultProxy()

      const userOp = await getUserOp(proxy, { signature: `0x${'00'.repeat(12)}` })
      const userOpHash = await entryPoint.getUserOpHash(userOp)

      await mockSignerFactory.givenMethodReturnAddress(defaultParams.signerFactory.interface.getFunction('getSigner').selector, mockSigner)
      await mockSignerFactory.givenMethodRevertWithMessage(
        defaultParams.signerFactory.interface.getFunction('isValidSignatureForSigner').selector,
        'error',
      )

      expect(await proxy.connect(entryPointImpersonator).validateUserOp.staticCall(userOp, userOpHash, 0)).to.equal(1)
    })

    it('Should revert it not called by the entry point', async () => {
      const { deployDefaultProxy, getUserOp, entryPoint } = await setupTests()

      const proxy = await deployDefaultProxy()

      const userOp = await getUserOp(proxy)
      const userOpHash = await entryPoint.getUserOpHash(userOp)

      await expect(proxy.validateUserOp(userOp, userOpHash, 0)).to.be.revertedWithCustomError(proxy, 'UnsupportedEntryPoint')
    })

    it('Should revert it calldata is not for `promoteAccountAndExecuteUserOp`', async () => {
      const { deployDefaultProxy, getUserOp, entryPoint, entryPointImpersonator } = await setupTests()

      const proxy = await deployDefaultProxy()

      const userOp = await getUserOp(proxy, { callData: '0x01020304' })
      const userOpHash = await entryPoint.getUserOpHash(userOp)

      await expect(proxy.connect(entryPointImpersonator).validateUserOp.staticCall(userOp, userOpHash, 0))
        .to.be.revertedWithCustomError(proxy, 'UnsupportedExecutionFunction')
        .withArgs('0x01020304')
    })
  })

  describe('promoteAccountAndExecuteUserOp', function () {
    for (const [name, operation] of [
      ['CALL', 0],
      ['DELEGATECALL', 1],
    ]) {
      it(`Should execute the ${name} user operation`, async () => {
        const { deployDefaultProxy, multiSend, mockSignerFactory, mockSigner, defaultParams, safeSingleton, entryPointImpersonator } =
          await setupTests()

        const proxy = await deployDefaultProxy()

        const MockContract = await ethers.getContractFactory('MockContract')
        const mockTarget = await MockContract.deploy()
        const mockData = '0x010203040506'
        await mockTarget.givenCalldataReturnBool(mockData, true)

        const [to, data] =
          operation === 0
            ? [await mockTarget.getAddress(), mockData]
            : [
                await multiSend.getAddress(),
                multiSend.interface.encodeFunctionData('multiSend', [
                  ethers.solidityPacked(
                    ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
                    [0, await mockTarget.getAddress(), 0, ethers.dataLength(mockData), mockData],
                  ),
                ]),
              ]

        const createSignerData = defaultParams.signerFactory.interface.encodeFunctionData('createSigner', [
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
        ])
        await mockSignerFactory.givenCalldataReturnAddress(createSignerData, mockSigner)

        await expect(
          proxy
            .connect(entryPointImpersonator)
            .promoteAccountAndExecuteUserOp(
              defaultParams.signerFactory,
              defaultParams.signerX,
              defaultParams.signerY,
              defaultParams.signerVerifiers,
              to,
              0,
              data,
              operation,
            ),
        ).to.not.be.reverted
        expect(await mockSignerFactory.invocationCountForCalldata(createSignerData)).to.equal(1)
        expect(await ethers.provider.getStorage(proxy, 0)).to.equal(
          ethers.AbiCoder.defaultAbiCoder().encode(['address'], [await safeSingleton.getAddress()]),
        )
        expect(await mockTarget.invocationCountForMethod(mockData)).to.equal(1)
      })

      it(`Should revert if the ${name} user operation reverts`, async () => {
        const { deployDefaultProxy, multiSend, mockSignerFactory, mockSigner, defaultParams, entryPointImpersonator } = await setupTests()

        const proxy = await deployDefaultProxy()

        const MockContract = await ethers.getContractFactory('MockContract')
        const mockTarget = await MockContract.deploy()
        await mockTarget.givenAnyRevertWithMessage('error')

        const [to, data] =
          operation === 0
            ? [await mockTarget.getAddress(), '0x']
            : [
                await multiSend.getAddress(),
                multiSend.interface.encodeFunctionData('multiSend', [
                  ethers.solidityPacked(
                    ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
                    [0, await mockTarget.getAddress(), 0, 0, '0x'],
                  ),
                ]),
              ]

        await mockSignerFactory.givenMethodReturnAddress(
          defaultParams.signerFactory.interface.getFunction('createSigner').selector,
          mockSigner,
        )

        await expect(
          proxy
            .connect(entryPointImpersonator)
            .promoteAccountAndExecuteUserOp(
              defaultParams.signerFactory,
              defaultParams.signerX,
              defaultParams.signerY,
              defaultParams.signerVerifiers,
              to,
              0,
              data,
              operation,
            ),
        ).to.be.revertedWithCustomError(proxy, 'ExecutionFailed')
      })
    }

    it(`Should transfer Ether as part of the user operation`, async () => {
      const { deployDefaultProxy, mockSignerFactory, mockSigner, defaultParams, entryPointImpersonator } = await setupTests()

      const proxy = await deployDefaultProxy()
      const target = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)))
      const value = ethers.parseEther('1')

      await mockSignerFactory.givenMethodReturnAddress(
        defaultParams.signerFactory.interface.getFunction('createSigner').selector,
        mockSigner,
      )

      await setBalance(await proxy.getAddress(), value)
      await proxy
        .connect(entryPointImpersonator)
        .promoteAccountAndExecuteUserOp(
          defaultParams.signerFactory,
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
          target,
          value,
          '0x',
          0,
        )
      expect(await ethers.provider.getBalance(target)).to.equal(value)
    })

    it(`Should revert if not called by entry point`, async () => {
      const { deployDefaultProxy, defaultParams } = await setupTests()

      const proxy = await deployDefaultProxy()

      await expect(
        proxy.promoteAccountAndExecuteUserOp(
          defaultParams.signerFactory,
          defaultParams.signerX,
          defaultParams.signerY,
          defaultParams.signerVerifiers,
          ethers.ZeroAddress,
          0,
          '0x',
          0,
        ),
      ).to.be.revertedWithCustomError(proxy, 'UnsupportedEntryPoint')
    })

    it(`Should revert if not initialized`, async () => {
      const { deployProxyWithoutSetup, defaultParams, entryPointImpersonator } = await setupTests()

      const proxy = await deployProxyWithoutSetup()

      await expect(
        proxy
          .connect(entryPointImpersonator)
          .promoteAccountAndExecuteUserOp(
            defaultParams.signerFactory,
            defaultParams.signerX,
            defaultParams.signerY,
            defaultParams.signerVerifiers,
            ethers.ZeroAddress,
            0,
            '0x',
            0,
          ),
      ).to.be.revertedWithCustomError(proxy, 'NotInitialized')
    })

    it(`Should revert if not initialized`, async () => {
      const { deployDefaultProxy, mockSignerFactory, mockSigner, defaultParams, entryPointImpersonator } = await setupTests()

      const proxy = await deployDefaultProxy()

      await mockSignerFactory.givenMethodReturnAddress(
        defaultParams.signerFactory.interface.getFunction('createSigner').selector,
        mockSigner,
      )

      await expect(
        proxy
          .connect(entryPointImpersonator)
          .promoteAccountAndExecuteUserOp(
            defaultParams.signerFactory,
            defaultParams.signerX,
            defaultParams.signerY,
            defaultParams.signerVerifiers,
            ethers.ZeroAddress,
            0,
            '0x',
            42,
          ),
      ).to.be.revertedWithPanic(0x21)
    })
  })
})
