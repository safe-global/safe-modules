import { setCode } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import * as ERC1271 from './utils/erc1271'
import { DUMMY_AUTHENTICATOR_DATA, base64UrlEncode, getSignatureBytes } from '../src/utils/webauthn'
import { encodeWebAuthnSigningMessage } from './utils/webauthnShim'

describe('SafeWebAuthnSignerFactory', () => {
  const setupTests = deployments.createFixture(async () => {
    const { SafeWebAuthnSignerFactory } = await deployments.fixture()

    const factory = await ethers.getContractAt('SafeWebAuthnSignerFactory', SafeWebAuthnSignerFactory.address)

    const MockContract = await ethers.getContractFactory('MockContract')
    const mockVerifier = await MockContract.deploy()
    const precompileAddress = `0x${'00'.repeat(18)}0100`
    const mockPrecompile = await ethers.getContractAt('MockContract', precompileAddress)
    await setCode(precompileAddress, await ethers.provider.getCode(mockVerifier))
    const verifiers = BigInt(ethers.solidityPacked(['uint16', 'uint160'], [mockPrecompile.target, mockVerifier.target]))

    return { factory, mockPrecompile, mockVerifier, verifiers }
  })

  describe('getSigner', function () {
    it('Should return the address that a signer will be created on', async () => {
      const { factory, verifiers } = await setupTests()

      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signer = await factory.getSigner(x, y, verifiers)

      expect(ethers.dataLength(await ethers.provider.getCode(signer))).to.equal(0)

      await factory.createSigner(x, y, verifiers)

      expect(ethers.dataLength(await ethers.provider.getCode(signer))).to.not.equal(0)
    })

    it('Should return different signer for different inputs', async () => {
      const { factory, verifiers } = await setupTests()

      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signer = await factory.getSigner(x, y, verifiers)

      for (const params of [
        [ethers.id('publicKey.otherX'), y, verifiers],
        [x, ethers.id('publicKey.otherY'), verifiers],
        [x, y, `0x${'fe'.repeat(20)}`],
      ] as const) {
        expect(await factory.getSigner(...params)).to.not.equal(signer)
      }
    })
  })

  describe('createSigner', function () {
    it('Should create a signer and return its deterministic address', async () => {
      const { factory, verifiers } = await setupTests()

      const singletonAddress = await factory.SINGLETON()
      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signer = await factory.createSigner.staticCall(x, y, verifiers)

      const SafeWebAuthnSignerProxy = await ethers.getContractFactory('SafeWebAuthnSignerProxy')
      const { data: initCode } = await SafeWebAuthnSignerProxy.getDeployTransaction(singletonAddress, x, y, verifiers)
      expect(signer).to.equal(ethers.getCreate2Address(await factory.getAddress(), ethers.ZeroHash, ethers.keccak256(initCode)))

      expect(ethers.dataLength(await ethers.provider.getCode(signer))).to.equal(0)

      await factory.createSigner(x, y, verifiers)

      expect(ethers.dataLength(await ethers.provider.getCode(signer))).to.not.equal(0)
    })

    it('Should be idempotent', async () => {
      const { factory, verifiers } = await setupTests()

      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signer = await factory.createSigner.staticCall(x, y, verifiers)

      await factory.createSigner(x, y, verifiers)

      expect(await factory.createSigner.staticCall(x, y, verifiers)).to.eq(signer)
      await expect(factory.createSigner(x, y, verifiers)).to.not.be.reverted
    })

    it('Should emit event only once', async () => {
      const { factory, verifiers } = await setupTests()

      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signer = await factory.createSigner.staticCall(x, y, verifiers)

      await expect(factory.createSigner(x, y, verifiers))
        .to.emit(factory, 'Created')
        .withArgs(signer, x, y, verifiers)
      await expect(factory.createSigner(x, y, verifiers)).not.to.emit(factory, 'Created')
    })
  })

  describe('isValidSignatureForSigner', function () {
    it('Should return true when the verifier returns true', async () => {
      const { factory, mockPrecompile, mockVerifier, verifiers } = await setupTests()

      const dataHash = ethers.id('some data to sign')
      const clientData = {
        type: 'webauthn.get' as const,
        challenge: base64UrlEncode(dataHash),
        origin: 'https://safe.global',
      }

      const r = BigInt(ethers.id('signature.r'))
      const s = BigInt(ethers.id('signature.s'))
      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signature = getSignatureBytes({
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: '"origin":"https://safe.global"',
        r,
        s,
      })

      await mockPrecompile.givenAnyReturnBool(false)
      await mockVerifier.givenCalldataReturnBool(
        ethers.solidityPacked(
          ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
          [ethers.sha256(encodeWebAuthnSigningMessage(clientData, DUMMY_AUTHENTICATOR_DATA)), r, s, x, y],
        ),
        true,
      )

      expect(await factory.isValidSignatureForSigner(dataHash, signature, x, y, verifiers)).to.equal(ERC1271.MAGIC_VALUE)
    })

    it('Should return true when the verifier without precompile returns true', async () => {
      const { factory, mockVerifier } = await setupTests()
      const mockVerifierAddress = await mockVerifier.getAddress()

      const dataHash = ethers.id('some data to sign')
      const clientData = {
        type: 'webauthn.get' as const,
        challenge: base64UrlEncode(dataHash),
        origin: 'https://safe.global',
      }

      const r = BigInt(ethers.id('signature.r'))
      const s = BigInt(ethers.id('signature.s'))
      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signature = getSignatureBytes({
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: '"origin":"https://safe.global"',
        r,
        s,
      })

      await mockVerifier.givenCalldataReturnBool(
        ethers.solidityPacked(
          ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
          [ethers.sha256(encodeWebAuthnSigningMessage(clientData, DUMMY_AUTHENTICATOR_DATA)), r, s, x, y],
        ),
        true,
      )

      expect(await factory.isValidSignatureForSigner(dataHash, signature, x, y, mockVerifierAddress)).to.equal(ERC1271.MAGIC_VALUE)
    })

    it('Should return true when the precompile returns true', async () => {
      const { factory, mockPrecompile, verifiers } = await setupTests()

      const dataHash = ethers.id('some data to sign')
      const clientData = {
        type: 'webauthn.get' as const,
        challenge: base64UrlEncode(dataHash),
        origin: 'https://safe.global',
      }

      const r = BigInt(ethers.id('signature.r'))
      const s = BigInt(ethers.id('signature.s'))
      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signature = getSignatureBytes({
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: '"origin":"https://safe.global"',
        r,
        s,
      })

      await mockPrecompile.givenCalldataReturnBool(
        ethers.solidityPacked(
          ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
          [ethers.sha256(encodeWebAuthnSigningMessage(clientData, DUMMY_AUTHENTICATOR_DATA)), r, s, x, y],
        ),
        true,
      )

      expect(await factory.isValidSignatureForSigner(dataHash, signature, x, y, verifiers)).to.equal(ERC1271.MAGIC_VALUE)
    })

    it('Should return false when the verifier does not return true', async () => {
      const { factory, mockVerifier, verifiers } = await setupTests()

      const dataHash = ethers.id('some data to sign')
      const clientData = {
        type: 'webauthn.get' as const,
        challenge: base64UrlEncode(dataHash),
        origin: 'https://safe.global',
      }

      const r = BigInt(ethers.id('signature.r'))
      const s = BigInt(ethers.id('signature.s'))
      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signature = getSignatureBytes({
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: '"origin":"https://safe.global"',
        r,
        s,
      })

      await mockVerifier.givenAnyReturnBool(true)
      await mockVerifier.givenCalldataReturn(
        ethers.solidityPacked(
          ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
          [ethers.sha256(encodeWebAuthnSigningMessage(clientData, DUMMY_AUTHENTICATOR_DATA)), r, s, x, y],
        ),
        '0xfe',
      )

      expect(await factory.isValidSignatureForSigner(dataHash, signature, x, y, verifiers)).to.not.equal(ERC1271.MAGIC_VALUE)
    })

    it('Should return false on non-matching authenticator flags', async () => {
      const { factory, mockPrecompile, mockVerifier, verifiers } = await setupTests()

      const dataHash = ethers.id('some data to sign')
      const authenticatorData = ethers.getBytes(
        ethers.solidityPacked(
          ['bytes32', 'uint8', 'uint32'],
          [
            ethers.toBeHex(ethers.MaxUint256),
            0, // no flags
            0xffffffff, // signCount
          ],
        ),
      )

      const r = BigInt(ethers.id('signature.r'))
      const s = BigInt(ethers.id('signature.s'))
      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signature = getSignatureBytes({
        authenticatorData,
        clientDataFields: '"origin":"https://safe.global"',
        r,
        s,
      })

      await mockPrecompile.givenAnyReturnBool(true)
      await mockVerifier.givenAnyReturnBool(true)
      expect(await factory.isValidSignatureForSigner(dataHash, signature, x, y, verifiers)).to.not.equal(ERC1271.MAGIC_VALUE)
    })
  })
})
