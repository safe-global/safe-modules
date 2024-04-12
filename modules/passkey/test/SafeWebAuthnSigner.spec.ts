import { setCode } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import * as ERC1271 from './utils/erc1271'
import { DUMMY_AUTHENTICATOR_DATA, base64UrlEncode, getSignatureBytes } from '../src/utils/webauthn'
import { encodeWebAuthnSigningMessage } from './utils/webauthnShim'

describe('SafeWebAuthnSigner', () => {
  const setupTests = deployments.createFixture(async () => {
    const x = ethers.id('publicKey.x')
    const y = ethers.id('publicKey.y')
    const MockContract = await ethers.getContractFactory('MockContract')
    const mockVerifier = await MockContract.deploy()
    const precompileAddress = `0x${'00'.repeat(18)}0100`
    const mockPrecompile = await ethers.getContractAt('MockContract', precompileAddress)
    await setCode(precompileAddress, await ethers.provider.getCode(mockVerifier))
    const SafeWebAuthnSigner = await ethers.getContractFactory('SafeWebAuthnSigner')
    const verifiers = BigInt(ethers.solidityPacked(['uint32', 'address'], [Number(precompileAddress), mockVerifier.target]))
    const signer = await SafeWebAuthnSigner.deploy(x, y, verifiers)

    return { x, y, mockPrecompile, mockVerifier, verifiers, signer }
  })

  describe('constructor', function () {
    it('Should set immutables', async () => {
      const { x, y, verifiers, signer } = await setupTests()

      expect(await signer.X()).to.equal(x)
      expect(await signer.Y()).to.equal(y)
      expect(await signer.VERIFIERS()).to.equal(verifiers)
    })
  })

  describe('isValidSignature', function () {
    it('Should return true when the verifier returns true', async () => {
      const { x, y, mockVerifier, signer } = await setupTests()

      const data = ethers.toUtf8Bytes('some data to sign')
      const dataHash = ethers.keccak256(data)

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

      await mockVerifier.givenCalldataReturnBool(
        ethers.solidityPacked(
          ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
          [ethers.sha256(encodeWebAuthnSigningMessage(clientData, DUMMY_AUTHENTICATOR_DATA)), r, s, x, y],
        ),
        true,
      )

      expect(await signer['isValidSignature(bytes32,bytes)'](dataHash, signature)).to.equal(ERC1271.MAGIC_VALUE)
      expect(await signer['isValidSignature(bytes,bytes)'](data, signature)).to.equal(ERC1271.LEGACY_MAGIC_VALUE)
    })

    it('Should return true when the precompile returns true', async () => {
      const { x, y, mockPrecompile, signer } = await setupTests()

      const data = ethers.toUtf8Bytes('some data to sign')
      const dataHash = ethers.keccak256(data)

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

      await mockPrecompile.givenCalldataReturnBool(
        ethers.solidityPacked(
          ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
          [ethers.sha256(encodeWebAuthnSigningMessage(clientData, DUMMY_AUTHENTICATOR_DATA)), r, s, x, y],
        ),
        true,
      )

      expect(await signer['isValidSignature(bytes32,bytes)'](dataHash, signature)).to.equal(ERC1271.MAGIC_VALUE)
      expect(await signer['isValidSignature(bytes,bytes)'](data, signature)).to.equal(ERC1271.LEGACY_MAGIC_VALUE)
    })

    it('Should return false when the verifier does not return true', async () => {
      const { x, y, mockVerifier, signer } = await setupTests()

      const data = ethers.toUtf8Bytes('some data to sign')
      const dataHash = ethers.keccak256(data)

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

      await mockVerifier.givenAnyReturnBool(true)
      await mockVerifier.givenCalldataReturn(
        ethers.solidityPacked(
          ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
          [ethers.sha256(encodeWebAuthnSigningMessage(clientData, DUMMY_AUTHENTICATOR_DATA)), r, s, x, y],
        ),
        '0xfe',
      )

      expect(await signer['isValidSignature(bytes32,bytes)'](dataHash, signature)).to.not.equal(ERC1271.MAGIC_VALUE)
      expect(await signer['isValidSignature(bytes,bytes)'](data, signature)).to.not.equal(ERC1271.LEGACY_MAGIC_VALUE)
    })

    it('Should return false on non-matching authenticator flags', async () => {
      const { mockVerifier, signer } = await setupTests()

      const data = ethers.toUtf8Bytes('some data to sign')
      const dataHash = ethers.keccak256(data)

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

      const signature = getSignatureBytes({
        authenticatorData,
        clientDataFields: '"origin":"https://safe.global"',
        r,
        s,
      })

      await mockVerifier.givenAnyReturnBool(true)
      expect(await signer['isValidSignature(bytes32,bytes)'](dataHash, signature)).to.not.equal(ERC1271.MAGIC_VALUE)
      expect(await signer['isValidSignature(bytes,bytes)'](data, signature)).to.not.equal(ERC1271.LEGACY_MAGIC_VALUE)
    })
  })
})
