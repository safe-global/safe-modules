import { expect } from 'chai'
import { BigNumberish, BytesLike } from 'ethers'
import { deployments, ethers } from 'hardhat'

import { Account } from '../utils/p256'

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

    const account = new Account()

    return { verifier, verifySignature, account }
  })

  it('Should return 1 on valid signature', async function () {
    const { verifySignature, account } = await setupTests()

    const message = ethers.id('hello world')
    const { r, s } = account.sign(message)
    const { x, y } = account.publicKey

    expect(await verifySignature(message, r, s, x, y)).to.be.true
  })

  it('Should ignore signature malleability', async function () {
    const { verifySignature, account } = await setupTests()

    const message = ethers.id('hello world')
    const { r, highS } = account.sign(message)
    const { x, y } = account.publicKey

    expect(await verifySignature(message, r, highS, x, y)).to.be.true
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
