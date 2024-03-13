import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

describe.only('WebAuthnVerifier', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { WebAuthnVerifier } = await deployments.fixture()
    const webAuthnVerifier = await ethers.getContractAt('WebAuthnVerifier', WebAuthnVerifier.address)
    return { webAuthnVerifier }
  })

  it('Should return false when invalid signature', async () => {
    const webAuthnVerifier = await setupTests()

    const authenticatorData = ethers.randomBytes(100)
    authenticatorData[32] = 0x01

    const challenge = ethers.randomBytes(32)
    const clientDataFields = ethers.randomBytes(100)

    expect(
      await webAuthnVerifier.webAuthnVerifier.verifyWebAuthnSignature(
        authenticatorData,
        '0x01',
        challenge,
        clientDataFields,
        [0n, 0n],
        0n,
        0n,
      ),
    ).to.be.false

    expect(
      await webAuthnVerifier.webAuthnVerifier.verifyWebAuthnSignatureAllowMalleability(
        authenticatorData,
        '0x01',
        challenge,
        clientDataFields,
        [0n, 0n],
        0n,
        0n,
      ),
    ).to.be.false
  })

  it('Should return false on non-matching authenticator flags', async () => {
    const webAuthnVerifier = await setupTests()

    const authenticatorData = ethers.randomBytes(100)
    authenticatorData[32] = 0x02

    const challenge = ethers.randomBytes(32)
    const clientDataFields = ethers.randomBytes(100)

    expect(
      await webAuthnVerifier.webAuthnVerifier.verifyWebAuthnSignature(
        authenticatorData,
        '0x01',
        challenge,
        clientDataFields,
        [0n, 0n],
        0n,
        0n,
      ),
    ).to.be.false

    expect(
      await webAuthnVerifier.webAuthnVerifier.verifyWebAuthnSignatureAllowMalleability(
        authenticatorData,
        '0x01',
        challenge,
        clientDataFields,
        [0n, 0n],
        0n,
        0n,
      ),
    ).to.be.false
  })
})
