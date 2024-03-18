import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import { Account } from '../utils/p256'

describe('P256', function () {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { FCLP256Verifier } = await deployments.fixture()

    const verifier = await ethers.getContractAt('FCLP256Verifier', FCLP256Verifier.address)

    const P256Lib = await ethers.getContractFactory('TestP256Lib')
    const p256Lib = await P256Lib.deploy()

    const account = new Account()

    return { verifier, p256Lib, account }
  })

  it('Should return true on valid signature', async function () {
    const { verifier, p256Lib, account } = await setupTests()

    const message = ethers.id('hello world')
    const { r, s } = account.sign(message)
    const { x, y } = account.publicKey

    expect(await p256Lib.verifySignature(verifier, message, r, s, x, y)).to.be.true
  })

  it('Should return false on invalid signature', async function () {
    const { verifier, p256Lib } = await setupTests()

    expect(await p256Lib.verifySignature(verifier, ethers.ZeroHash, 1, 2, 3, 4)).to.be.false
  })

  it('Should check for signature signature malleability', async function () {
    const { verifier, p256Lib, account } = await setupTests()

    const message = ethers.id('hello world')
    const { r, highS } = account.sign(message)
    const { x, y } = account.publicKey

    expect(await p256Lib.verifySignature(verifier, message, r, highS, x, y)).to.be.false
    expect(await p256Lib.verifySignatureAllowMalleability(verifier, message, r, highS, x, y)).to.be.true
  })

  it('Should return false for misbehaving verifiers', async function () {
    const { p256Lib, account } = await setupTests()

    const message = ethers.id('hello world')
    const { r, s } = account.sign(message)
    const { x, y } = account.publicKey

    const BadP256Verifier = await ethers.getContractFactory('BadP256Verifier')
    const WRONG_RETURNDATA_LENGTH = 0
    const INVALID_BOOLEAN_VALUE = 1
    const REVERT = 2

    for (const behaviour of [WRONG_RETURNDATA_LENGTH, INVALID_BOOLEAN_VALUE, REVERT]) {
      const verifier = await BadP256Verifier.deploy(behaviour)
      expect(await p256Lib.verifySignature(verifier, message, r, s, x, y)).to.be.false
      expect(await p256Lib.verifySignatureAllowMalleability(verifier, message, r, s, x, y)).to.be.false
    }
  })
})
