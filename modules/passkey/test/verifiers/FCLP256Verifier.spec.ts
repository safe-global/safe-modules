import { p256 } from '@noble/curves/p256'
import { expect } from 'chai'
import { BigNumberish, BytesLike } from 'ethers'
import { deployments, ethers } from 'hardhat'

describe('FCLP256Verifier', function () {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { FCLP256Verifier } = await deployments.fixture()

    const verifier = await ethers.getContractAt('FCLP256Verifier', FCLP256Verifier.address)

    async function verifySignature(message: BytesLike, r: BigNumberish, s: BigNumberish, x: BigNumberish, y: BigNumberish) {
      const coder = ethers.AbiCoder.defaultAbiCoder()
      const [success] = coder.decode(
        ['bool'],
        await verifier.fallback!.staticCall({
          data: coder.encode(['bytes32', 'uint256', 'uint256', 'uint256', 'uint256'], [message, r, s, x, y]),
        }),
      )
      return success
    }

    const privateKey = p256.utils.normPrivateKeyToScalar(ethers.toBeArray(ethers.id('secret')))
    function sign(message: BytesLike) {
      const hex = ethers.hexlify(message).slice(2)
      return p256.sign(hex, privateKey, {
        lowS: false,
        prehash: false,
      })
    }

    const encodedPublicKey = p256.getPublicKey(privateKey, false)
    const publicKey = {
      x: BigInt(ethers.hexlify(encodedPublicKey.subarray(1, 33))),
      y: BigInt(ethers.hexlify(encodedPublicKey.subarray(33, 65))),
    }

    return { verifier, verifySignature, privateKey, sign, publicKey }
  })

  it('Should return 1 on valid signature', async function () {
    const { verifySignature, sign, publicKey } = await setupTests()

    const message = ethers.id('hello world')
    const signature = sign(message)

    expect(await verifySignature(message, signature.r, signature.s, publicKey.x, publicKey.y)).to.be.true
  })

  it('Should ignore signature malleability', async function () {
    const { verifySignature, sign, publicKey } = await setupTests()

    const message = ethers.id('hello world')
    const signature = sign(message)

    const minusS = p256.CURVE.n - signature.s
    expect(minusS > p256.CURVE.n / 2n).to.be.true

    expect(await verifySignature(message, signature.r, minusS, publicKey.x, publicKey.y)).to.be.true
  })

  it('Should return 0 on invalid signature', async function () {
    const { verifySignature } = await setupTests()

    expect(await verifySignature(ethers.ZeroHash, 1, 2, 3, 4)).to.be.false
  })

  it('Should return 0 on invalid input', async function () {
    const { verifier } = await setupTests()

    expect(await verifier.fallback!.staticCall({ data: ethers.hexlify(ethers.toUtf8Bytes('invalid input')) })).to.equal(ethers.ZeroHash)
  })
})
