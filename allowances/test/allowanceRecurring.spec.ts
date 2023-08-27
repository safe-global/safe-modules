import { expect } from 'chai'
import hre from 'hardhat'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers'

import { TestToken, TestToken__factory } from '../typechain-types'

import deploySingletons from './test-helpers/deploySingletons'
import deploySafeProxy from './test-helpers/deploySafeProxy'
import execTransaction from './test-helpers/execTransaction'
import execAllowanceTransfer from './test-helpers/execAllowanceTransfer'

describe('AllowanceModule allowanceRecurring', async () => {
  async function setup() {
    const [owner, alice, bob, deployer] = await hre.ethers.getSigners()

    const singletons = await deploySingletons(deployer)
    const safe = await deploySafeProxy(owner.address, singletons)
    const token = await deployTestToken(deployer)

    await token.transfer(safe.address, 1000)

    // enable Allowance as mod
    await execTransaction(
      safe,
      {
        to: safe.address,
        data: safe.interface.encodeFunctionData('enableModule', [
          singletons.allowanceModule.address,
        ]),
      },
      owner
    )

    return {
      // singletons
      safeMastercopy: singletons.safeMastercopy,
      safeProxyFactory: singletons.safeProxyFactory,
      allowanceModule: singletons.allowanceModule,
      // the deployed safe
      safe,
      // test token
      token,
      // some signers
      owner,
      alice,
      bob,
    }
  }

  function nowInMinutes() {
    return Math.floor(Date.now() / (1000 * 60))
  }

  function calculateResetLast(
    base: number,
    period: number,
    now: number = nowInMinutes()
  ) {
    return now - ((now - base) % period)
  }

  before(
    async () => await hre.network.provider.request({ method: 'hardhat_reset' })
  )

  it('Execute allowance without refund', async () => {
    const { allowanceModule, safe, token, owner, alice, bob } =
      await loadFixture(setup)

    // add alice as delegate
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.addDelegate(alice.address),
      owner
    )

    // create an allowance for alice
    const configResetPeriod = 60 * 24
    const configResetBase = nowInMinutes() - 30

    // the very first resetLast produced by the contract
    // i.e., before the first period is elapsed, and
    // the contract updates/resets allowance
    const firstResetLast = calculateResetLast(
      configResetBase,
      configResetPeriod
    )

    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.setAllowance(
        alice.address,
        token.address,
        100,
        configResetPeriod,
        configResetBase
      ),
      owner
    )

    // load an existing allowance
    let [amount, spent, resetPeriod, resetLast, nonce] =
      await allowanceModule.getTokenAllowance(
        safe.address,
        alice.address,
        token.address
      )

    expect(100).to.equal(amount)
    expect(0).to.equal(spent)
    expect(configResetPeriod).to.equal(resetPeriod)
    expect(firstResetLast).to.equal(resetLast) // this should be set to inti time
    expect(1).to.equal(nonce)

    expect(1000).to.equal(await token.balanceOf(safe.address))
    expect(0).to.equal(await token.balanceOf(bob.address))

    // transfer 60 bucks to bob
    await execAllowanceTransfer(allowanceModule, {
      safe: safe.address,
      token: token.address,
      to: bob.address,
      amount: 60,
      spender: alice,
    })

    expect(940).to.equal(await token.balanceOf(safe.address))
    expect(60).to.equal(await token.balanceOf(bob.address))

    // load alice's allowance
    ;[amount, spent, resetPeriod, resetLast, nonce] =
      await allowanceModule.getTokenAllowance(
        safe.address,
        alice.address,
        token.address
      )
    expect(100).to.equal(amount)
    expect(60).to.equal(spent)
    expect(configResetPeriod).to.equal(resetPeriod)
    expect(firstResetLast).to.equal(resetLast)
    expect(2).to.equal(nonce)

    // check that it fails over limit
    await expect(
      execAllowanceTransfer(allowanceModule, {
        safe: safe.address,
        token: token.address,
        to: bob.address,
        amount: 45,
        spender: alice,
      })
    ).to.be.reverted

    await execAllowanceTransfer(allowanceModule, {
      safe: safe.address,
      token: token.address,
      to: bob.address,
      amount: 40,
      spender: alice,
    })
    expect(900).to.equal(await token.balanceOf(safe.address))
    expect(100).to.equal(await token.balanceOf(bob.address))

    // go forward 12 hours (13 intervals with one hour between)
    await mine(13, { interval: 60 * 60 })

    // load alice's allowance, with less than resetPeriod elapsed: des not impact spend
    ;[amount, spent, resetPeriod, resetLast, nonce] =
      await allowanceModule.getTokenAllowance(
        safe.address,
        alice.address,
        token.address
      )
    expect(100).to.equal(amount)
    expect(100).to.equal(spent)
    expect(configResetPeriod).to.equal(resetPeriod)
    expect(firstResetLast).to.equal(resetLast)
    expect(3).to.equal(nonce)

    // however going forward 12 hours more (24 in total) should replenish
    await mine(13, { interval: 60 * 60 })
    ;[amount, spent, resetPeriod, resetLast, nonce] =
      await allowanceModule.getTokenAllowance(
        safe.address,
        alice.address,
        token.address
      )

    // let's predict the next value calculated by the contract for lastReset
    const expectedLastReset = calculateResetLast(
      configResetBase,
      configResetPeriod,
      nowInMinutes() + 60 * 24
    )

    expect(100).to.equal(amount)
    expect(0).to.equal(spent)
    expect(configResetPeriod).to.equal(resetPeriod)
    expect(expectedLastReset).to.be.equal(resetLast)
    expect(3).to.equal(nonce)

    // lets execute on the replenished allowance
    await execAllowanceTransfer(allowanceModule, {
      safe: safe.address,
      token: token.address,
      to: bob.address,
      amount: 45,
      spender: alice,
    })
    expect(855).to.equal(await token.balanceOf(safe.address))
    expect(145).to.equal(await token.balanceOf(bob.address))
    ;[amount, spent, resetPeriod, resetLast, nonce] =
      await allowanceModule.getTokenAllowance(
        safe.address,
        alice.address,
        token.address
      )

    expect(100).to.equal(amount)
    expect(45).to.equal(spent)
    expect(configResetPeriod).to.equal(resetPeriod)
    expect(expectedLastReset).to.be.equal(resetLast)
    expect(4).to.equal(nonce)
  })
})

async function deployTestToken(minter: SignerWithAddress): Promise<TestToken> {
  const factory: TestToken__factory = await hre.ethers.getContractFactory(
    'TestToken',
    minter
  )
  return await factory.connect(minter).deploy()
}
