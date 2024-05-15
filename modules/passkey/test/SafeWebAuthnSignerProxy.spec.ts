import { setCode } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import * as ERC1271 from './utils/erc1271'
import { DUMMY_AUTHENTICATOR_DATA, base64UrlEncode, getSignatureBytes } from '../src/utils/webauthn'
import { encodeWebAuthnSigningMessage } from './utils/webauthnShim'

describe('SafeWebAuthnSignerProxy', () => {
  const setupTests = deployments.createFixture(async () => {
    const x = ethers.id('publicKey.x')
    const y = ethers.id('publicKey.y')
    const MockContract = await ethers.getContractFactory('MockContract')
    const mockVerifier = await MockContract.deploy()
    const precompileAddress = `0x${'00'.repeat(18)}0100`
    const mockPrecompile = await ethers.getContractAt('MockContract', precompileAddress)
    await setCode(precompileAddress, await ethers.provider.getCode(mockVerifier))
    const verifiers = BigInt(ethers.solidityPacked(['uint16', 'address'], [Number(precompileAddress), mockVerifier.target]))
    const singleton = await (await ethers.getContractFactory('SafeWebAuthnSignerSingleton')).deploy()
    const SafeWebAuthnSignerProxy = await ethers.getContractFactory('SafeWebAuthnSignerProxy')
    const signer = await ethers.getContractAt(
      'SafeWebAuthnSignerSingleton',
      (await SafeWebAuthnSignerProxy.deploy(singleton, x, y, verifiers)).target,
    )

    return { x, y, mockPrecompile, mockVerifier, verifiers, signer }
  })

  describe('fallback', function () {
    it('Should forward call to singleton with additional information', async () => {
      const { x, y, mockVerifier } = await setupTests()
      const [sender] = await ethers.getSigners()
      const mockSingleton = await ethers.getContractAt('MockContract', await (await ethers.getContractFactory('MockContract')).deploy())

      const verifiers = ethers.solidityPacked(['uint16', 'address'], [0x0100, mockVerifier.target])

      const signerProxy = await ethers.getContractAt(
        'MockContract',
        await (await ethers.getContractFactory('SafeWebAuthnSignerProxy')).deploy(mockSingleton, x, y, verifiers),
      )

      const callData = ethers.hexlify(ethers.randomBytes(36))
      await signerProxy.givenAnyReturnBool(true)
      await sender.sendTransaction({ to: signerProxy.target, value: 0, data: callData })

      expect(await signerProxy.invocationCount()).to.equal(1)
      const data = ethers.solidityPacked(['bytes', 'uint256', 'uint256', 'uint176'], [callData, x, y, verifiers])
      expect(await signerProxy.invocationCountForCalldata(data)).to.equal(1)
    })
  })

  describe('constructor', function () {
    it('Should set immutables', async () => {
      const { x, y, verifiers, signer } = await setupTests()
      const [X, Y, VERIFIERS] = await signer.getConfiguration()
      expect(X).to.equal(x)
      expect(Y).to.equal(y)
      expect(VERIFIERS).to.equal(verifiers)
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
      const { x, y, mockPrecompile, mockVerifier, signer } = await setupTests()

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

      await mockPrecompile.givenAnyReturnBool(false)
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
