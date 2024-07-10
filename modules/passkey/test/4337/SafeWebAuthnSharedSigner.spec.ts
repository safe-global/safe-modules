import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import * as ERC1271 from '../utils/erc1271'
import { DUMMY_AUTHENTICATOR_DATA, base64UrlEncode, getSignatureBytes } from '../../src/utils/webauthn'
import { encodeWebAuthnSigningMessage } from '../utils/webauthnShim'

const SIGNER_MAPPING_SLOT = BigInt(ethers.id('SafeWebAuthnSharedSigner.signer')) - 1n

describe('SafeWebAuthnSharedSigner', () => {
  const setupTests = deployments.createFixture(async () => {
    const { SafeL2, SafeProxyFactory, CompatibilityFallbackHandler, SafeWebAuthnSharedSigner } = await deployments.run()

    const safeSingleton = await ethers.getContractAt('ISafe', SafeL2.address)
    const fallbackHandler = await ethers.getContractAt(CompatibilityFallbackHandler.abi, CompatibilityFallbackHandler.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const sharedSigner = await ethers.getContractAt('SafeWebAuthnSharedSigner', SafeWebAuthnSharedSigner.address)

    const signerSlot = ethers.solidityPackedKeccak256(['uint256', 'uint256'], [sharedSigner.target, SIGNER_MAPPING_SLOT])

    const MockContract = await ethers.getContractFactory('MockContract')
    const mockAccount = await MockContract.deploy()
    const mockVerifier = await MockContract.deploy()

    const TestSharedWebAuthnSignerAccessor = await ethers.getContractFactory('TestSharedWebAuthnSignerAccessor')
    const sharedSignerAccessor = await TestSharedWebAuthnSignerAccessor.deploy()

    return {
      safeSingleton,
      fallbackHandler,
      proxyFactory,
      sharedSigner,
      signerSlot,
      mockAccount,
      mockVerifier,
      sharedSignerAccessor,
    }
  })

  describe('getConfiguration', function () {
    it('Should return a configuration for an account', async () => {
      const { safeSingleton, sharedSigner, signerSlot, mockAccount, mockVerifier } = await setupTests()

      const publicKey = {
        x: BigInt(ethers.id('publicKey.x')),
        y: BigInt(ethers.id('publicKey.y')),
      }

      await mockAccount.givenCalldataReturn(
        safeSingleton.interface.encodeFunctionData('getStorageAt', [signerSlot, 3]),
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes'],
          [ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256', 'uint176'], [publicKey.x, publicKey.y, mockVerifier.target])],
        ),
      )

      expect(await sharedSigner.getConfiguration(mockAccount)).to.deep.equal([
        publicKey.x,
        publicKey.y,
        BigInt(mockVerifier.target as string),
      ])
    })

    it('Should return empty configuration for a non-configured account', async () => {
      const { sharedSigner } = await setupTests()

      const randomAccount = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)))

      expect(await sharedSigner.getConfiguration(randomAccount)).to.deep.equal([0n, 0n, 0n])
    })

    it('Should return empty configuration if getting storage for account reverts', async () => {
      const { sharedSigner, mockAccount } = await setupTests()

      await mockAccount.givenAnyRevertWithMessage('error')

      expect(await sharedSigner.getConfiguration(mockAccount)).to.deep.equal([0n, 0n, 0n])
    })

    it('Should return empty configuration for non-standard ABI encoded storage result', async () => {
      const { sharedSigner, mockAccount } = await setupTests()

      for (const returnData of [
        // additional padding at end
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes'],
          [ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256', 'uint176'], [1, 2, 3])],
        ) + '00',
        // additional padding in the middle
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes', 'uint256'],
          [ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256', 'uint176'], [1, 2, 3]), 0],
        ),
        // unexpected offset
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes', 'uint256'],
          [ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint176'], [1, 2]), 0x60],
        ),
        // unexpected length
        ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256', 'uint256', 'uint256', 'uint256'], [0x20, 0x40, 1, 1, 0]),
      ]) {
        await mockAccount.givenAnyReturn(returnData)
        expect(await sharedSigner.getConfiguration(mockAccount)).to.deep.equal([0n, 0n, 0n])
      }
    })

    it('Should store the signer configuration in a mapping with the shared signer address as a key', async () => {
      const { safeSingleton, fallbackHandler, proxyFactory, sharedSigner, mockVerifier, sharedSignerAccessor } = await setupTests()

      const config = {
        x: ethers.id('publicKey.x'),
        y: ethers.id('publicKey.y'),
        verifiers: ethers.toBeHex(await mockVerifier.getAddress(), 32),
      }

      const initializer = safeSingleton.interface.encodeFunctionData('setup', [
        [sharedSigner.target],
        1,
        sharedSigner.target,
        sharedSigner.interface.encodeFunctionData('configure', [config]),
        fallbackHandler.target,
        ethers.ZeroAddress,
        0,
        ethers.ZeroAddress,
      ])

      const safeProxy = fallbackHandler.attach(
        await proxyFactory.createProxyWithNonce.staticCall(safeSingleton, initializer, 0),
      ) as typeof fallbackHandler
      await proxyFactory.createProxyWithNonce(safeSingleton, initializer, 0)

      expect(
        ethers.AbiCoder.defaultAbiCoder().decode(
          ['uint256', 'uint256', 'uint176'],
          await safeProxy.simulate.staticCall(
            sharedSignerAccessor.target,
            sharedSignerAccessor.interface.encodeFunctionData('getSignerConfiguration', [sharedSigner.target]),
          ),
        ),
      ).to.deep.equal([config.x, config.y, BigInt(config.verifiers)])
    })
  })

  describe('configure', function () {
    it('Should configure an account', async () => {
      const { safeSingleton, proxyFactory, sharedSigner, signerSlot, mockVerifier } = await setupTests()

      const config = {
        x: ethers.id('publicKey.x'),
        y: ethers.id('publicKey.y'),
        verifiers: ethers.toBeHex(await mockVerifier.getAddress(), 32),
      }

      const initializer = safeSingleton.interface.encodeFunctionData('setup', [
        [sharedSigner.target],
        1,
        sharedSigner.target,
        sharedSigner.interface.encodeFunctionData('configure', [config]),
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        0,
        ethers.ZeroAddress,
      ])

      const account = await proxyFactory.createProxyWithNonce.staticCall(safeSingleton, initializer, 0)
      await proxyFactory.createProxyWithNonce(safeSingleton, initializer, 0)

      expect(await ethers.provider.getStorage(account, signerSlot)).to.equal(config.x)
      expect(await ethers.provider.getStorage(account, BigInt(signerSlot) + 1n)).to.equal(config.y)
      expect(await ethers.provider.getStorage(account, BigInt(signerSlot) + 2n)).to.equal(config.verifiers)
    })

    it('Should emit an event', async () => {
      const { safeSingleton, proxyFactory, sharedSigner, mockVerifier } = await setupTests()

      const config = {
        x: ethers.id('publicKey.x'),
        y: ethers.id('publicKey.y'),
        verifiers: ethers.toBeHex(await mockVerifier.getAddress(), 32),
      }

      const initializer = safeSingleton.interface.encodeFunctionData('setup', [
        [sharedSigner.target],
        1,
        sharedSigner.target,
        sharedSigner.interface.encodeFunctionData('configure', [config]),
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        0,
        ethers.ZeroAddress,
      ])

      const account = await proxyFactory.createProxyWithNonce.staticCall(safeSingleton, initializer, 0)
      await expect(proxyFactory.createProxyWithNonce(safeSingleton, initializer, 0))
        .to.emit(sharedSigner.attach(account), 'SafeWebAuthnSharedSignerConfigured')
        .withArgs(config.x, config.y, config.verifiers)
    })

    it('Should revert if not DELEGATECALL-ed', async () => {
      const { sharedSigner } = await setupTests()

      await expect(sharedSigner.configure({ x: 1, y: 2, verifiers: 3 })).to.be.revertedWithCustomError(sharedSigner, 'NotDelegateCalled')
    })
  })

  describe('isValidSignature', function () {
    it('Should return a magic value for an account', async () => {
      const { safeSingleton, sharedSigner, signerSlot, mockAccount, mockVerifier } = await setupTests()

      const data = ethers.toUtf8Bytes('some data to sign')
      const dataHash = ethers.keccak256(data)

      const x = BigInt(ethers.id('publicKey.x'))
      const y = BigInt(ethers.id('publicKey.y'))
      const clientData = {
        type: 'webauthn.get' as const,
        challenge: base64UrlEncode(dataHash),
        origin: 'https://safe.global',
      }

      const r = BigInt(ethers.id('signature.r'))
      const s = BigInt(ethers.id('signature.s'))

      const signature = getSignatureBytes({
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: '"origin":"https://safe.global"',
        r,
        s,
      })

      await mockAccount.givenCalldataReturn(
        safeSingleton.interface.encodeFunctionData('getStorageAt', [signerSlot, 3]),
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes'],
          [ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256', 'uint176'], [x, y, mockVerifier.target])],
        ),
      )
      await mockVerifier.givenCalldataReturnBool(
        ethers.solidityPacked(
          ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
          [ethers.sha256(encodeWebAuthnSigningMessage(clientData, DUMMY_AUTHENTICATOR_DATA)), r, s, x, y],
        ),
        true,
      )

      const mockAccountImpersonator = await ethers.getSigner(await mockAccount.getAddress())
      const target = sharedSigner.connect(mockAccountImpersonator)

      expect(await target['isValidSignature(bytes32,bytes)'](dataHash, signature)).to.equal(ERC1271.MAGIC_VALUE)
      expect(await target['isValidSignature(bytes,bytes)'](data, signature)).to.equal(ERC1271.LEGACY_MAGIC_VALUE)
    })

    it('Should not verify signature if invalid', async () => {
      const { sharedSigner, mockAccount, mockVerifier } = await setupTests()

      const data = ethers.toUtf8Bytes('some data to sign')
      const dataHash = ethers.keccak256(data)

      const r = BigInt(ethers.id('signature.r'))
      const s = BigInt(ethers.id('signature.s'))
      const signature = getSignatureBytes({
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: '"origin":"https://safe.global"',
        r,
        s,
      })

      await mockAccount.givenAnyReturn(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes'],
          [ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256', 'uint176'], [1, 2, mockVerifier.target])],
        ),
      )
      await mockVerifier.givenAnyReturn('0x')

      const mockAccountImpersonator = await ethers.getSigner(await mockAccount.getAddress())
      const target = sharedSigner.connect(mockAccountImpersonator)

      expect(await target['isValidSignature(bytes32,bytes)'](dataHash, signature)).to.equal('0x00000000')
      expect(await target['isValidSignature(bytes,bytes)'](data, signature)).to.equal('0x00000000')
    })

    it('Should not verify signature if account not configured', async () => {
      const { sharedSigner } = await setupTests()

      const data = ethers.toUtf8Bytes('some data to sign')
      const dataHash = ethers.keccak256(data)

      const r = BigInt(ethers.id('signature.r'))
      const s = BigInt(ethers.id('signature.s'))
      const signature = getSignatureBytes({
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: '"origin":"https://safe.global"',
        r,
        s,
      })

      const randomAccount = await ethers.getSigner(ethers.getAddress(ethers.hexlify(ethers.randomBytes(20))))
      const target = sharedSigner.connect(randomAccount)

      expect(await target['isValidSignature(bytes32,bytes)'](dataHash, signature)).to.equal('0x00000000')
      expect(await target['isValidSignature(bytes,bytes)'](data, signature)).to.equal('0x00000000')
    })
  })
})
