import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import { Account } from '../../src/utils/p256'

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

    const message = ethers.id('hello passkeys')
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

    const message = ethers.id('hello passkeys')
    const { r, highS } = account.sign(message)
    const { x, y } = account.publicKey

    expect(await p256Lib.verifySignature(verifier, message, r, highS, x, y)).to.be.false
    expect(await p256Lib.verifySignatureAllowMalleability(verifier, message, r, highS, x, y)).to.be.true
  })

  it('Should return false for misbehaving verifiers', async function () {
    const { p256Lib, account } = await setupTests()

    const message = ethers.id('hello passkeys')
    const { r, s } = account.sign(message)
    const { x, y } = account.publicKey

    const MockContract = await ethers.getContractFactory('MockContract')
    const mockVerifier = await MockContract.deploy()

    for (const configureMock of [
      // wrong return data length
      () => mockVerifier.givenAnyReturn(ethers.AbiCoder.defaultAbiCoder().encode(['bool', 'uint256'], [true, 42])),
      // invalid boolean value
      () => mockVerifier.givenAnyReturnUint(ethers.MaxUint256),
      // revert
      () => mockVerifier.givenAnyRevert(),
    ]) {
      await configureMock()
      expect(await p256Lib.verifySignature(mockVerifier, message, r, s, x, y)).to.be.false
      expect(await p256Lib.verifySignatureAllowMalleability(mockVerifier, message, r, s, x, y)).to.be.false
    }
  })
})
