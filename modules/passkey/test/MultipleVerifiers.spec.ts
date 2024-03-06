import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import { WebAuthnCredentials, decodePublicKey, encodeWebAuthnSignature } from './utils/webauthn'
import { IP256Verifier } from '../typechain-types'

describe('Multiple Verifiers', function () {
  const navigator = {
    credentials: new WebAuthnCredentials(),
  }
  const credential = navigator.credentials.create({
    publicKey: {
      rp: {
        name: 'Safe',
        id: 'safe.global',
      },
      user: {
        id: ethers.getBytes(ethers.id('chucknorris')),
        name: 'chucknorris',
        displayName: 'Chuck Norris',
      },
      challenge: ethers.toBeArray(Date.now()),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    },
  })

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { DaimoP256Verifier, FCLP256Verifier } = await deployments.fixture()

    const verifiers = {
      fcl: await ethers.getContractAt('IP256Verifier', FCLP256Verifier.address),
      daimo: await ethers.getContractAt('IP256Verifier', DaimoP256Verifier.address),
    } as Record<string, IP256Verifier>

    // TODO: Right now, we are using a test factory. However, once the canonical factory is
    // introduced, we should port this test to use it instead.
    const TestWebAuthnSignerFactory = await ethers.getContractFactory('TestWebAuthnSignerFactory')
    const factory = await TestWebAuthnSignerFactory.deploy()

    return { verifiers, credential, factory }
  })

  for (const [name, key] of [
    ['FreshCryptoLib', 'fcl'],
    ['daimo-eth', 'daimo'],
  ]) {
    it(`Should support the ${name} P-256 Verifier`, async function () {
      const { verifiers, credential, factory } = await setupTests()

      const challenge = ethers.id('hello world')
      const assertion = navigator.credentials.get({
        publicKey: {
          challenge: ethers.getBytes(challenge),
          rpId: 'safe.global',
          allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
        },
      })

      const verifier = verifiers[key]
      const { x, y } = decodePublicKey(credential.response)

      const signer = await ethers.getContractAt('TestWebAuthnSigner', await factory.createSigner.staticCall(verifier, x, y))
      const signature = encodeWebAuthnSignature(assertion.response)

      await factory.createSigner(verifier, x, y)
      expect(await signer.isValidSignature(challenge, signature)).to.be.equal('0x1626ba7e')
    })
  }
})
