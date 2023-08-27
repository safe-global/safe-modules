import { expect } from 'chai'
import hre from 'hardhat'
import { ZeroAddress, parseUnits } from 'ethers'

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import setup from './test-helpers/setup'
import execTransaction from './test-helpers/execTransaction'
import execAllowanceTransfer from './test-helpers/execAllowanceTransfer'

const OneEther = parseUnits('1', 'ether')

describe('AllowanceModule allowanceSingle', async () => {
  it('Execute allowance with delegate', async () => {
    const { safe, allowanceModule, token, owner, alice, bob } =
      await loadFixture(setup)

    const safeAddress = await safe.getAddress()
    const tokenAddress = await token.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()

    /*
     * Safe will 1000 tokens in balance
     * Alice configured as spender in Allowance
     * Bob not configured as spender in any Allowance
     *
     * Alice sends to Bob
     */

    expect(await safe.isModuleEnabled(allowanceAddress)).to.equal(true)

    // Note: both Allowance creation, and Delegate setting must be done from the
    // safe, via SafeTransaction

    // add alice as delegate
    await execTransaction(
      safe,
      await allowanceModule.addDelegate.populateTransaction(alice.address),
      owner
    )

    // create an allowance for alice
    await execTransaction(
      safe,
      await allowanceModule.setAllowance.populateTransaction(
        alice.address,
        tokenAddress,
        100,
        0,
        0
      ),
      owner
    )

    // ensure delegates are well configured
    const { results } = await allowanceModule.getDelegates(safeAddress, 0, 10)
    expect(results).to.deep.equal([alice.address])

    // ensure tokens from allowances are correct
    expect(
      await allowanceModule.getTokens(safeAddress, alice.address)
    ).to.deep.equal([tokenAddress])

    // load an existing allowance
    let [amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        tokenAddress
      )
    expect(100).to.equal(amount)
    expect(0).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(0).to.not.equal(lastReset) // this should be set to inti time
    expect(1).to.equal(nonce)

    // load an non existing allowance - bob has non
    ;[amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        bob.address,
        tokenAddress
      )
    expect(0).to.equal(amount)
    expect(0).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(0).to.equal(lastReset)
    expect(0).to.equal(nonce)

    expect(1000).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(alice.address))
    expect(0).to.equal(await token.balanceOf(bob.address))

    await execAllowanceTransfer(allowanceModule, {
      safe: safeAddress,
      token: tokenAddress,
      to: bob.address,
      amount: 60,
      spender: alice,
    })

    expect(940).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(alice.address))
    expect(60).to.equal(await token.balanceOf(bob.address))

    // load Alice's Allowance
    ;[amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        tokenAddress
      )

    // expect the last transfer to be reflected
    expect(100).to.equal(amount)
    expect(60).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(lastReset > 0).to.be.true
    expect(2).to.equal(nonce)

    // remove Alice's as spender
    await execTransaction(
      safe,
      await allowanceModule.removeDelegate.populateTransaction(
        alice.address,
        true
      ),
      owner
    )

    // load Alice's Allowance after delegate removal
    ;[amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        tokenAddress
      )

    // everything zeroed, except nonce
    expect(0).to.equal(amount)
    expect(0).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(0).to.equal(lastReset)
    expect(2).to.equal(nonce)
  })

  it('Execute multiple ether allowance with delegate', async () => {
    const { provider } = hre.ethers
    const { safe, allowanceModule, owner, alice } = await loadFixture(setup)

    const safeAddress = await safe.getAddress()

    // fund the safe
    await owner.sendTransaction({
      to: safeAddress,
      value: parseUnits('1', 'ether'),
    })

    /*
     * Safe will contain 1 ETH
     * Alice configured as ETH spender in Allowance
     * Bob not configured as spender in any Allowance
     *
     * Alice sends to Bob
     */
    const bob = '0x0000000000000000000000000000000000abcdef'

    // add alice as delegate
    await execTransaction(
      safe,
      await allowanceModule.addDelegate.populateTransaction(alice.address),
      owner
    )

    // create an allowance for alice
    await execTransaction(
      safe,
      await allowanceModule.setAllowance.populateTransaction(
        alice.address,
        ZeroAddress, // zero means ether
        OneEther,
        0,
        0
      ),
      owner
    )

    // load an existing allowance
    let [amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        ZeroAddress
      )
    expect(OneEther).to.equal(amount)
    expect(0).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(0).to.not.equal(lastReset) // this should be set to inti time
    expect(1).to.equal(nonce)

    expect(OneEther).to.equal(await provider.getBalance(safeAddress))
    expect(0).to.equal(await provider.getBalance(bob))

    // send 0.001 to bob using alice's allowance
    await execAllowanceTransfer(allowanceModule, {
      safe: safeAddress,
      token: ZeroAddress,
      to: bob,
      amount: parseUnits('0.001', 'ether'),
      spender: alice,
    })

    expect(parseUnits('0.999', 'ether')).to.equal(
      await provider.getBalance(safeAddress)
    )
    expect(parseUnits('0.001', 'ether')).to.equal(
      await provider.getBalance(bob)
    )

    // load Alice's Allowance
    ;[amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        ZeroAddress
      )

    // expect the last transfer to be reflected
    expect(parseUnits('1', 'ether')).to.equal(amount)
    expect(parseUnits('0.001', 'ether')).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(lastReset > 0).to.be.true
    expect(2).to.equal(nonce)

    // send 0.001 more
    await execAllowanceTransfer(allowanceModule, {
      safe: safeAddress,
      token: ZeroAddress,
      to: bob,
      amount: parseUnits('0.001', 'ether'),
      spender: alice,
    })

    expect(parseUnits('0.998', 'ether')).to.equal(
      await provider.getBalance(safeAddress)
    )
    expect(parseUnits('0.002', 'ether')).to.equal(
      await provider.getBalance(bob)
    )

    // load Alice's Allowance
    ;[amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        ZeroAddress
      )

    // expect the last transfer to be reflected
    expect(parseUnits('1', 'ether')).to.equal(amount)
    expect(parseUnits('0.002', 'ether')).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(lastReset > 0).to.be.true
    expect(3).to.equal(nonce)
  })
})
