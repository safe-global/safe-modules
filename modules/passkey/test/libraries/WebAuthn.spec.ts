import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { DUMMY_CLIENT_DATA_FIELDS, base64UrlEncode, getSignatureBytes } from '../utils/webauthn'

describe('WebAuthn Library', () => {
  const setupTests = deployments.createFixture(async () => {
    const WebAuthnLibFactory = await ethers.getContractFactory('TestWebAuthnLib')
    const webAuthnLib = await WebAuthnLibFactory.deploy()
    const mockP256Verifier = await (await ethers.getContractFactory('MockContract')).deploy()

    return { webAuthnLib, mockP256Verifier }
  })

  it('Should return false when the verifier returns false', async () => {
    const { webAuthnLib, mockP256Verifier } = await setupTests()
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

    expect(await webAuthnLib.verifySignature(challenge, signature, '0x01', 0n, 0n, mockP256Verifier.target)).to.be.false

    expect(await webAuthnLib.verifySignatureCastSig(challenge, signatureBytes, '0x01', 0n, 0n, mockP256Verifier.target)).to.be.false
  })

  it('Should return false on non-matching authenticator flags', async () => {
    const { webAuthnLib, mockP256Verifier } = await setupTests()
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

    expect(await webAuthnLib.verifySignature(challenge, signature, '0x01', 0n, 0n, mockP256Verifier.target)).to.be.false

    expect(await webAuthnLib.verifySignatureCastSig(challenge, signatureBytes, '0x01', 0n, 0n, mockP256Verifier.target)).to.be.false
  })

  it('Should return true when the verifier returns true', async () => {
    const { webAuthnLib, mockP256Verifier } = await setupTests()
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

    expect(await webAuthnLib.verifySignature(challenge, signature, '0x01', 0n, 0n, mockP256Verifier.target)).to.be.true

    expect(await webAuthnLib.verifySignatureCastSig(challenge, signatureBytes, '0x01', 0n, 0n, mockP256Verifier.target)).to.be.true
  })

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
    const message = ethers.sha256(ethers.concat([authenticatorData, clientDataHash]))

    expect(await webAuthnLib.signingMessage(challenge, authenticatorData, `"origin":"http://safe.global"`)).to.equal(message)
  })
})
