import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import * as ERC1271 from './utils/erc1271'
import { DUMMY_AUTHENTICATOR_DATA, base64UrlEncode, encodeWebAuthnSigningMessage, getSignatureBytes } from '../src/utils/webauthn'

describe('SafeWebAuthnSignerFactory', () => {
  const setupTests = deployments.createFixture(async () => {
    const { SafeWebAuthnSignerFactory } = await deployments.fixture()
    const factory = await ethers.getContractAt('SafeWebAuthnSignerFactory', SafeWebAuthnSignerFactory.address)

    const MockContract = await ethers.getContractFactory('MockContract')
    const mockVerifier = await MockContract.deploy()

    return { factory, mockVerifier }
  })

  describe('getSigner', function () {
    it('Should return the address that a signer will be created on', async () => {
      const { factory, mockVerifier } = await setupTests()

      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signer = await factory.getSigner(x, y, mockVerifier)

      expect(ethers.dataLength(await ethers.provider.getCode(signer))).to.equal(0)

      await factory.createSigner(x, y, mockVerifier)

      expect(ethers.dataLength(await ethers.provider.getCode(signer))).to.not.equal(0)
    })

    it('Should return different signer for different inputs', async () => {
      const { factory, mockVerifier } = await setupTests()

      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signer = await factory.getSigner(x, y, mockVerifier)

      for (const params of [
        [ethers.id('publicKey.otherX'), y, mockVerifier],
        [x, ethers.id('publicKey.otherY'), mockVerifier],
        [x, y, '0x0000000000000000000000000000000000000100'],
      ] as const) {
        expect(await factory.getSigner(...params)).to.not.equal(signer)
      }
    })
  })

  describe('createSigner', function () {
    it('Should create a signer and return its deterministic address', async () => {
      const { factory, mockVerifier } = await setupTests()

      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signer = await factory.createSigner.staticCall(x, y, mockVerifier)

      const SafeWebAuthnSigner = await ethers.getContractFactory('SafeWebAuthnSigner')
      const { data: initCode } = await SafeWebAuthnSigner.getDeployTransaction(x, y, mockVerifier)
      expect(signer).to.equal(ethers.getCreate2Address(await factory.getAddress(), ethers.ZeroHash, ethers.keccak256(initCode)))

      expect(ethers.dataLength(await ethers.provider.getCode(signer))).to.equal(0)

      await factory.createSigner(x, y, mockVerifier)

      expect(ethers.dataLength(await ethers.provider.getCode(signer))).to.not.equal(0)
    })

    it('Should be idempotent', async () => {
      const { factory, mockVerifier } = await setupTests()

      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signer = await factory.createSigner.staticCall(x, y, mockVerifier)

      await factory.createSigner(x, y, mockVerifier)

      expect(await factory.createSigner.staticCall(x, y, mockVerifier)).to.eq(signer)
      await expect(factory.createSigner(x, y, mockVerifier)).to.not.be.reverted
    })
  })

  describe('isValidSignatureForSigner', function () {
    it('Should return true when the verifier returns true', async () => {
      const { factory, mockVerifier } = await setupTests()

      const dataHash = ethers.id('some data to sign')
      const clientData = {
        type: 'webauthn.get' as const,
        challenge: base64UrlEncode(dataHash),
        origin: 'https://safe.global',
      }

      const r = ethers.id('signature.r')
      const s = ethers.id('signature.s')
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

      expect(await factory.isValidSignatureForSigner(dataHash, signature, x, y, mockVerifier)).to.equal(ERC1271.MAGIC_VALUE)
    })

    it('Should return false when the verifier does not return true', async () => {
      const { factory, mockVerifier } = await setupTests()

      const dataHash = ethers.id('some data to sign')
      const clientData = {
        type: 'webauthn.get' as const,
        challenge: base64UrlEncode(dataHash),
        origin: 'https://safe.global',
      }

      const r = ethers.id('signature.r')
      const s = ethers.id('signature.s')
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

      expect(await factory.isValidSignatureForSigner(dataHash, signature, x, y, mockVerifier)).to.not.equal(ERC1271.MAGIC_VALUE)
    })

    it('Should return false on non-matching authenticator flags', async () => {
      const { factory, mockVerifier } = await setupTests()

      const dataHash = ethers.id('some data to sign')
      const authenticatorData = ethers.solidityPacked(
        ['bytes32', 'uint8', 'uint32'],
        [
          ethers.toBeHex(ethers.MaxUint256),
          0, // no flags
          0xffffffff, // signCount
        ],
      )

      const r = ethers.id('signature.r')
      const s = ethers.id('signature.s')
      const x = ethers.id('publicKey.x')
      const y = ethers.id('publicKey.y')

      const signature = getSignatureBytes({
        authenticatorData,
        clientDataFields: '"origin":"https://safe.global"',
        r,
        s,
      })

      await mockVerifier.givenAnyReturnBool(true)
      expect(await factory.isValidSignatureForSigner(dataHash, signature, x, y, mockVerifier)).to.not.equal(ERC1271.MAGIC_VALUE)
    })
  })
})
