import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

describe('Lock', function () {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { Lock } = await deployments.fixture()

    const [owner, otherAccount] = await ethers.getSigners()
    const lock = await ethers.getContractAt('Lock', Lock.address)

    const unlockTime = await lock.unlockTime()
    const lockedAmount = await ethers.provider.getBalance(lock)

    return { lock, unlockTime, lockedAmount, owner, otherAccount }
  })

  describe('Deployment', function () {
    it('Should set the right unlockTime', async function () {
      const { lock, unlockTime } = await setupTests()

      expect(await lock.unlockTime()).to.equal(unlockTime)
    })

    it('Should set the right owner', async function () {
      const { lock, owner } = await setupTests()

      expect(await lock.owner()).to.equal(owner.address)
    })

    it('Should receive and store the funds to lock', async function () {
      const { lock, lockedAmount } = await setupTests()

      expect(await ethers.provider.getBalance(lock.target)).to.equal(lockedAmount)
    })

    it('Should fail if the unlockTime is not in the future', async function () {
      // We don't use the fixture here because we want a different deployment
      const latestTime = await time.latest()
      const Lock = await ethers.getContractFactory('Lock')
      await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith('Unlock time should be in the future')
    })
  })

  describe('Withdrawals', function () {
    describe('Validations', function () {
      it('Should revert with the right error if called too soon', async function () {
        const { lock } = await setupTests()

        await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet")
      })

      it('Should revert with the right error if called from another account', async function () {
        const { lock, unlockTime, otherAccount } = await setupTests()

        // We can increase the time in Hardhat Network
        await time.increaseTo(unlockTime)

        // We use lock.connect() to send a transaction from another account
        await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith("You aren't the owner")
      })

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { lock, unlockTime } = await setupTests()

        // Transactions are sent using the first signer by default
        await time.increaseTo(unlockTime)

        await expect(lock.withdraw()).not.to.be.reverted
      })
    })

    describe('Events', function () {
      it('Should emit an event on withdrawals', async function () {
        const { lock, unlockTime, lockedAmount } = await setupTests()

        await time.increaseTo(unlockTime)

        await expect(lock.withdraw()).to.emit(lock, 'Withdrawal').withArgs(lockedAmount, anyValue) // We accept any value as `when` arg
      })
    })

    describe('Transfers', function () {
      it('Should transfer the funds to the owner', async function () {
        const { lock, unlockTime, lockedAmount, owner } = await setupTests()

        await time.increaseTo(unlockTime)

        await expect(lock.withdraw()).to.changeEtherBalances([owner, lock], [lockedAmount, -lockedAmount])
      })
    })
  })
})
