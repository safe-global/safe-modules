import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { DUMMY_AUTHENTICATOR_DATA, DUMMY_CLIENT_DATA_FIELDS, base64UrlEncode, getSignatureBytes } from '../../src/utils/webauthn'

const base64 = {
  encodeFromHex: (h: string) => {
    const normalized = h.startsWith('0x') ? h.slice(2) : h

    return Buffer.from(normalized, 'hex').toString('base64url')
  },
}

describe('WebAuthn Library', () => {
  const setupTests = deployments.createFixture(async () => {
    const WebAuthnLibFactory = await ethers.getContractFactory('TestWebAuthnLib')
    const webAuthnLib = await WebAuthnLibFactory.deploy()
    const mockP256Verifier = await (await ethers.getContractFactory('MockContract')).deploy()

    return { webAuthnLib, mockP256Verifier }
  })

  describe('castSignature', function () {
    it('Should correctly cast an ABI encoded WebAuthn signature', async () => {
      const { webAuthnLib } = await setupTests()

      const signature = {
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
        r: 42n,
        s: 1337n,
      }

      expect(
        await webAuthnLib.castSignature(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes', 'string', 'uint256', 'uint256'],
            [signature.authenticatorData, signature.clientDataFields, signature.r, signature.s],
          ),
        ),
      ).to.deep.equal([ethers.hexlify(signature.authenticatorData), signature.clientDataFields, signature.r, signature.s])
    })

    it('Should correctly cast a packed encoded WebAuthn signature', async () => {
      const { webAuthnLib } = await setupTests()

      const signature = {
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
        r: 42n,
        s: 1337n,
      }

      expect(
        await webAuthnLib.castSignature(
          ethers.solidityPacked(
            ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes', 'uint256', 'string'],
            [
              128, // offset of authenticator data
              160 + signature.authenticatorData.length, // offset of client data fields
              signature.r,
              signature.s,
              signature.authenticatorData.length,
              signature.authenticatorData,
              signature.clientDataFields.length,
              signature.clientDataFields,
            ],
          ),
        ),
      ).to.deep.equal([ethers.hexlify(signature.authenticatorData), signature.clientDataFields, signature.r, signature.s])
    })

    it('Should correctly cast a partially packed encoded WebAuthn signature', async () => {
      const { webAuthnLib } = await setupTests()

      const signature = {
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
        r: 42n,
        s: 1337n,
      }

      expect(
        await webAuthnLib.castSignature(
          ethers.solidityPacked(
            ['uint256', 'uint256', 'uint256', 'uint256', 'bytes1', 'uint256', 'bytes', 'bytes2', 'uint256', 'string'],
            [
              128 + 1, // offset of authenticator data
              160 + signature.authenticatorData.length + 3, // offset of client data fields
              signature.r,
              signature.s,
              '0x00', // padding
              signature.authenticatorData.length,
              signature.authenticatorData,
              '0x0000', // padding
              signature.clientDataFields.length,
              signature.clientDataFields,
            ],
          ),
        ),
      ).to.deep.equal([ethers.hexlify(signature.authenticatorData), signature.clientDataFields, signature.r, signature.s])
    })

    it('Should detect encoded WebAuthn signatures with too much padding', async () => {
      const { webAuthnLib } = await setupTests()

      const signature = {
        authenticatorData: DUMMY_AUTHENTICATOR_DATA,
        clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
        r: 42n,
        s: 1337n,
      }
      const signatureBytes = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes', 'string', 'uint256', 'uint256'],
        [signature.authenticatorData, signature.clientDataFields, signature.r, signature.s],
      )

      await expect(webAuthnLib.castSignature(ethers.concat([signatureBytes, '0x00']))).to.be.revertedWith('invalid signature encoding')
    })
  })

  describe('encodeClientDataJson', function () {
    it('Should correctly base-64 encode the 32 byte challenge', async () => {
      const { webAuthnLib } = await setupTests()

      for (let i = 0; i < 50; i++) {
        const challenge = ethers.hexlify(ethers.randomBytes(32))
        const clientData = JSON.parse(await webAuthnLib.encodeClientDataJson(challenge, DUMMY_CLIENT_DATA_FIELDS))

        expect(clientData.challenge).to.be.equal(base64.encodeFromHex(challenge))
      }
    })
  })

  describe('encodeSigningMessage', function () {
    it('Should correctly compute a signing message', async () => {
      const { webAuthnLib } = await setupTests()

      const authenticatorData = ethers.randomBytes(100)
      authenticatorData[32] = 0x01
      const challenge = ethers.randomBytes(32)
      const encodedChallenge = base64UrlEncode(ethers.solidityPacked(['bytes32'], [challenge]))

      const clientData = {
        type: 'webauthn.get',
        challenge: encodedChallenge,
        origin: 'http://safe.global',
      }
      const clientDataHash = ethers.sha256(ethers.toUtf8Bytes(JSON.stringify(clientData)))
      const message = ethers.concat([authenticatorData, clientDataHash])

      expect(await webAuthnLib.encodeSigningMessage(challenge, authenticatorData, `"origin":"http://safe.global"`)).to.equal(message)
    })

    it('Should revert if SHA-256 precompile reverts', async () => {
      const { webAuthnLib } = await setupTests()

      // This test is a bit tricky - the SHA-256 precompile can be made to revert by calling it
      // with insufficient gas. Here we check that the revert is propagated by the
      // `encodeSigningMessage` function. If the revert were not propagated, since the input is
      // large enough, the function would be able to finish executing and return bogus data. Finding
      // a large enough client data and exact gas limits to make this happen is a bit annoying, so
      // lets hope for no gas schedule changes :fingers_crossed:.
      const longClientDataFields = `"long":"${'a'.repeat(100000)}"`
      await expect(webAuthnLib.encodeSigningMessage(ethers.ZeroHash, '0x', longClientDataFields, { gasLimit: 1701001 })).to.be.reverted
    })
  })

  describe('verifySignature', function () {
    it('Should return false when the verifier returns false', async () => {
      const { webAuthnLib, mockP256Verifier } = await setupTests()
      const mockP256VerifierAddress = await mockP256Verifier.getAddress()
      await mockP256Verifier.givenAnyReturnBool(false)

      const authenticatorData = ethers.randomBytes(100)
      authenticatorData[32] = 0x01

      const challenge = ethers.randomBytes(32)

      const signature = {
        authenticatorData,
        clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
        r: 0n,
        s: 0n,
      }
      const signatureBytes = getSignatureBytes(signature)

      expect(await webAuthnLib.verifySignature(challenge, signature, '0x01', 0n, 0n, mockP256VerifierAddress)).to.be.false

      expect(await webAuthnLib.verifySignatureCastSig(challenge, signatureBytes, '0x01', 0n, 0n, mockP256VerifierAddress)).to.be.false
    })

    it('Should return false on non-matching authenticator flags', async () => {
      const { webAuthnLib, mockP256Verifier } = await setupTests()
      const mockP256VerifierAddress = await mockP256Verifier.getAddress()
      // The authenticator check happens on the library level, so false is returned before the verifier is called
      await mockP256Verifier.givenAnyReturnBool(true)

      const authenticatorData = ethers.randomBytes(100)
      authenticatorData[32] = 0x02

      const challenge = ethers.randomBytes(32)

      const signature = {
        authenticatorData,
        clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
        r: 0n,
        s: 0n,
      }
      const signatureBytes = getSignatureBytes(signature)

      expect(await webAuthnLib.verifySignature(challenge, signature, '0x01', 0n, 0n, mockP256VerifierAddress)).to.be.false

      expect(await webAuthnLib.verifySignatureCastSig(challenge, signatureBytes, '0x01', 0n, 0n, mockP256VerifierAddress)).to.be.false
    })

    it('Should return true when the verifier returns true', async () => {
      const { webAuthnLib, mockP256Verifier } = await setupTests()
      const mockP256VerifierAddress = await mockP256Verifier.getAddress()
      await mockP256Verifier.givenAnyReturnBool(true)

      const authenticatorData = ethers.randomBytes(100)
      authenticatorData[32] = 0x01

      const challenge = ethers.randomBytes(32)
      const signature = {
        authenticatorData,
        clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
        r: 0n,
        s: 0n,
      }
      const signatureBytes = getSignatureBytes(signature)

      expect(await webAuthnLib.verifySignature(challenge, signature, '0x01', 0n, 0n, mockP256VerifierAddress)).to.be.true

      expect(await webAuthnLib.verifySignatureCastSig(challenge, signatureBytes, '0x01', 0n, 0n, mockP256VerifierAddress)).to.be.true
    })

    it('Should return false when the signature data has too much padding', async () => {
      const { webAuthnLib, mockP256Verifier } = await setupTests()
      const mockP256VerifierAddress = await mockP256Verifier.getAddress()
      await mockP256Verifier.givenAnyReturnBool(true)

      const authenticatorData = ethers.randomBytes(100)
      authenticatorData[32] = 0x01

      const challenge = ethers.randomBytes(32)
      const signature = {
        authenticatorData,
        clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
        r: 0n,
        s: 0n,
      }
      const signatureBytes = getSignatureBytes(signature)
      const paddedSignatureBytes = ethers.concat([signatureBytes, '0x00'])

      expect(await webAuthnLib.verifySignatureCastSig(challenge, signatureBytes, '0x01', 0n, 0n, mockP256VerifierAddress)).to.be.true
      expect(await webAuthnLib.verifySignatureCastSig(challenge, paddedSignatureBytes, '0x01', 0n, 0n, mockP256VerifierAddress)).to.be.false
    })
  })
})
