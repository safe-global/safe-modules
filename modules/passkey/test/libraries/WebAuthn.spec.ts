import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import hre from 'hardhat'
import { DUMMY_CLIENT_DATA_FIELDS, DUMMY_SIGNATURE_BYTES, getSignatureBytes } from '../utils/webauthn'

describe('WebAuthn Library', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { FCLP256Verifier } = await deployments.fixture()
    const verifier = await ethers.getContractAt('FCLP256Verifier', FCLP256Verifier.address)

    const WebAuthnLibFactory = await ethers.getContractFactory('TestWebAuthnLib')
    const deployedWebAuthnLib = await WebAuthnLibFactory.deploy()
    const webAuthnLib = await ethers.getContractAt('TestWebAuthnLib', await deployedWebAuthnLib.getAddress())
    const mockP256Verifier = await (await hre.ethers.getContractFactory('MockContract')).deploy()

    return { webAuthnLib, verifier, mockP256Verifier }
  })

  it('Should return false when invalid signature', async () => {
    const { webAuthnLib, verifier } = await setupTests()

    const authenticatorData = ethers.randomBytes(100)
    authenticatorData[32] = 0x01

    const challenge = ethers.randomBytes(32)

    const signature = {
      authenticatorData,
      clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
      r: 0n,
      s: 0n,
    }

    expect(await webAuthnLib.verifySignature(challenge, signature, '0x01', 0n, 0n, verifier.target)).to.be.false

    expect(await webAuthnLib.verifySignatureCastSig(challenge, DUMMY_SIGNATURE_BYTES, '0x01', 0n, 0n, verifier.target)).to.be.false
  })

  it('Should return false on non-matching authenticator flags', async () => {
    const { webAuthnLib, verifier, mockP256Verifier } = await setupTests()
    await mockP256Verifier.givenAnyRevert()

    const authenticatorData = ethers.randomBytes(100)
    authenticatorData[32] = 0x02

    const challenge = ethers.randomBytes(32)

    const signature = {
      authenticatorData,
      clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
      r: 0n,
      s: 0n,
    }

    expect(await webAuthnLib.verifySignature(challenge, signature, '0x01', 0n, 0n, verifier.target)).to.be.false

    expect(await webAuthnLib.verifySignatureCastSig(challenge, DUMMY_SIGNATURE_BYTES, '0x01', 0n, 0n, verifier.target)).to.be.false
  })

  it('Should return true on successful signature checks', async () => {
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
    const signatureBytes = getSignatureBytes(signature.authenticatorData, signature.clientDataFields, signature.r, signature.s)

    expect(await webAuthnLib.verifySignature(challenge, signature, '0x01', 0n, 0n, mockP256Verifier.target)).to.be.true

    expect(await webAuthnLib.verifySignatureCastSig(challenge, signatureBytes, '0x01', 0n, 0n, mockP256Verifier.target)).to.be.true
  })
})
