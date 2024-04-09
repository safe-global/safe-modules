import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import { WebAuthnCredentials } from '../test/utils/webauthn'
import { decodePublicKey, encodeWebAuthnSignature } from '../src/utils/webauthn'
import { IP256Verifier } from '../typechain-types'

describe('Gas Benchmarking [@bench]', function () {
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
    const { DaimoP256Verifier, FCLP256Verifier, SafeWebAuthnSignerFactory } = await deployments.fixture()

    const Benchmarker = await ethers.getContractFactory('Benchmarker')
    const benchmarker = await Benchmarker.deploy()

    const factory = await ethers.getContractAt('SafeWebAuthnSignerFactory', SafeWebAuthnSignerFactory.address)

    const DummyP256Verifier = await ethers.getContractFactory('DummyP256Verifier')
    const verifiers = {
      fcl: await ethers.getContractAt('IP256Verifier', FCLP256Verifier.address),
      daimo: await ethers.getContractAt('IP256Verifier', DaimoP256Verifier.address),
      dummy: await DummyP256Verifier.deploy(),
    } as Record<string, IP256Verifier>

    return { benchmarker, factory, verifiers }
  })

  describe('SafeWebAuthnSigner', () => {
    it(`Benchmark signer deployment cost`, async function () {
      const { benchmarker, factory } = await setupTests()

      const { x, y } = decodePublicKey(credential.response)
      const verifier = `0x${'ee'.repeat(20)}`

      const [gas] = await benchmarker.call.staticCall(factory, factory.interface.encodeFunctionData('createSigner', [x, y, verifier]))

      console.log(`      ⛽ deployment: ${gas}`)
    })

    for (const [name, key] of [
      ['FreshCryptoLib', 'fcl'],
      ['daimo-eth', 'daimo'],
      ['Dummy', 'dummy'],
    ]) {
      it(`Benchmark signer verification cost with ${name} verifier`, async function () {
        const { benchmarker, verifiers, factory } = await setupTests()

        const challenge = ethers.id('hello world')
        const assertion = navigator.credentials.get({
          publicKey: {
            challenge: ethers.getBytes(challenge),
            rpId: 'safe.global',
            allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
            userVerification: 'required',
          },
        })

        const { x, y } = decodePublicKey(credential.response)
        const verifier = verifiers[key]

        await factory.createSigner(x, y, verifier)
        const signer = await ethers.getContractAt('SafeWebAuthnSigner', await factory.getSigner(x, y, verifier))
        const signature = encodeWebAuthnSignature(assertion.response)

        const [gas, returnData] = await benchmarker.call.staticCall(
          signer,
          signer.interface.encodeFunctionData('isValidSignature(bytes32,bytes)', [challenge, signature]),
        )

        const [magicValue] = ethers.AbiCoder.defaultAbiCoder().decode(['bytes4'], returnData)
        expect(magicValue).to.equal('0x1626ba7e')

        console.log(`      ⛽ verification (${name}): ${gas}`)
      })
    }
  })
})
