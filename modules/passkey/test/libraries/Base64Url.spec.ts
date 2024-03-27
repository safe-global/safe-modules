import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

const base64 = {
  encodeFromHex: (h: string) => {
    const normalized = h.startsWith('0x') ? h.slice(2) : h

    return Buffer.from(normalized, 'hex').toString('base64url')
  },
}

describe('WebAuthn Library', () => {
  const setupTests = deployments.createFixture(async () => {
    const Base64UrlLibFactory = await ethers.getContractFactory('TestBase64UrlLib')
    const base64UrlLib = await Base64UrlLibFactory.deploy()

    return { base64UrlLib }
  })

  it('Encode: Should correctly base64 encode a bytes32 hash', async () => {
    const { base64UrlLib } = await setupTests()

    for (let i = 0; i < 50; i++) {
      const input = ethers.keccak256(ethers.randomBytes(32))
      const base64Encoded = base64.encodeFromHex(input)

      expect(await base64UrlLib.encode(input)).to.be.equal(base64Encoded)
    }
  })
})
