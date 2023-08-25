import hre from 'hardhat'
import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { TestToken, TestToken__factory } from '../typechain-types'

import deploySingletons from './helpers/deploySingletons'
import deploySafeProxy from './helpers/deploySafeProxy'
import execTransaction from './helpers/execTransaction'
import execAllowanceTransfer from './helpers/executeAllowanceTransfer'

describe.only('AllowanceModule Single', async () => {
  async function setup() {
    const [owner, alice, bob, spender, receiver, deployer, johndoe] =
      await hre.ethers.getSigners()

    const singletons = await deploySingletons(deployer)
    const safe = await deploySafeProxy(owner.address, singletons)
    const token = await deployTestToken(deployer)

    // fund the safe
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
      spender,
      receiver,
    }
  }
  it('Execute allowance with delegate', async () => {
    const { allowanceModule, safe, token, owner, alice, bob } =
      await loadFixture(setup)

    /*
     * Safe will 1000 tokens in balance
     * Alice configured as spender in Allowance
     * Bob not configured as spender in any Allowance
     *
     * Alice spends and sends to Bob
     */

    expect(await safe.isModuleEnabled(allowanceModule.address)).to.equal(true)

    // Note: both Allowance creation, and Delegate setting must be done from the
    // safe, via SafeTransaction

    // add alice as delegate
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.addDelegate(alice.address),
      owner
    )

    // create an allowance for alice
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.setAllowance(
        alice.address,
        token.address,
        100,
        0,
        0
      ),
      owner
    )

    // ensure delegates are well configured
    const { results } = await allowanceModule.getDelegates(safe.address, 0, 10)
    expect(results).to.deep.equal([alice.address])

    // ensure tokens from allowances are correct
    expect(
      await allowanceModule.getTokens(safe.address, alice.address)
    ).to.deep.equal([token.address])

    // load an existing alowance
    let [amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safe.address,
        alice.address,
        token.address
      )
    expect(100).to.equal(amount)
    expect(0).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(0).to.not.equal(lastReset) // this should be set to inti time
    expect(1).to.equal(nonce)

    // load an non existing allowance - bob has non
    ;[amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safe.address,
        bob.address,
        token.address
      )
    expect(0).to.equal(amount)
    expect(0).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(0).to.equal(lastReset)
    expect(0).to.equal(nonce)

    expect(1000).to.equal(await token.balanceOf(safe.address))
    expect(0).to.equal(await token.balanceOf(alice.address))
    expect(0).to.equal(await token.balanceOf(bob.address))

    await execAllowanceTransfer(allowanceModule, {
      safe,
      token,
      to: bob,
      amount: 60,
      spender: alice,
    })

    expect(940).to.equal(await token.balanceOf(safe.address))
    expect(0).to.equal(await token.balanceOf(alice.address))
    expect(60).to.equal(await token.balanceOf(bob.address))

    // load Alice's Allowance
    ;[amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safe.address,
        alice.address,
        token.address
      )

    // see the last transfer reflected
    expect(100).to.equal(amount)
    expect(60).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(lastReset.gt(0)).to.be.true
    expect(2).to.equal(nonce)

    // remove Alice's as spender
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.removeDelegate(
        alice.address,
        true
      ),
      owner
    )

    // load Alice's Allowance after delegate removal
    ;[amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safe.address,
        alice.address,
        token.address
      )

    // everything zeroed, except nonce
    expect(0).to.equal(amount)
    expect(0).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(0).to.equal(lastReset)
    expect(2).to.equal(nonce)
  })
})

async function deployTestToken(minter: SignerWithAddress): Promise<TestToken> {
  const factory: TestToken__factory = await hre.ethers.getContractFactory(
    'TestToken',
    minter
  )
  return await factory.connect(minter).deploy()
}
