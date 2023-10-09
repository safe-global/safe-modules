import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'

import execAllowanceTransfer from './test-helpers/execAllowanceTransfer'
import execSafeTransaction from './test-helpers/execSafeTransaction'
import setup from './test-helpers/setup'

describe('AllowanceModule allowanceManagement', () => {
  it('Add delegates and removes first delegate', async () => {
    const { safe, allowanceModule, owner, alice, bob } =
      await loadFixture(setup)

    const safeAddress = await safe.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()

    expect(await safe.isModuleEnabled(allowanceAddress)).to.equal(true)

    // add alice as delegate
    await execSafeTransaction(
      safe,
      await allowanceModule.addDelegate.populateTransaction(alice.address),
      owner
    )

    // add bob as delegate
    await execSafeTransaction(
      safe,
      await allowanceModule.addDelegate.populateTransaction(bob.address),
      owner
    )

    let delegates = await allowanceModule.getDelegates(safeAddress, 0, 10)

    expect(delegates.results).to.deep.equal([bob.address, alice.address])
    expect(delegates.next).to.equal(0)

    // remove bob
    await execSafeTransaction(
      safe,
      await allowanceModule.removeDelegate.populateTransaction(
        bob.address,
        true
      ),
      owner
    )
    delegates = await allowanceModule.getDelegates(safeAddress, 0, 10)

    expect(delegates.results).to.deep.equal([alice.address])
    expect(delegates.next).to.equal(0)
  })

  it('Add delegates and removes second delegate', async () => {
    const { safe, allowanceModule, owner, alice, bob } =
      await loadFixture(setup)

    const safeAddress = await safe.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()

    expect(await safe.isModuleEnabled.staticCall(allowanceAddress)).to.equal(
      true
    )

    // add alice as delegate
    await execSafeTransaction(
      safe,
      await allowanceModule.addDelegate.populateTransaction(alice.address),
      owner
    )

    // add bob as delegate
    await execSafeTransaction(
      safe,
      await allowanceModule.addDelegate.populateTransaction(bob.address),
      owner
    )

    let delegates = await allowanceModule.getDelegates(safeAddress, 0, 10)

    expect(delegates.results).to.deep.equal([bob.address, alice.address])
    expect(delegates.next).to.equal(0)

    // remove alice
    await execSafeTransaction(
      safe,
      await allowanceModule.removeDelegate.populateTransaction(
        alice.address,
        true
      ),
      owner
    )
    delegates = await allowanceModule.getDelegates(safeAddress, 0, 10)

    expect(delegates.results).to.deep.equal([bob.address])
    expect(delegates.next).to.equal(0)
  })

  it('Add and remove delegate and then try to execute', async () => {
    const { safe, allowanceModule, token, owner, alice, bob } =
      await loadFixture(setup)

    const safeAddress = await safe.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()
    const tokenAddress = await token.getAddress()

    expect(await safe.isModuleEnabled(allowanceAddress)).to.equal(true)

    // add alice as delegate
    await execSafeTransaction(
      safe,
      await allowanceModule.addDelegate.populateTransaction(alice.address),
      owner
    )

    // add allowance
    await execSafeTransaction(
      safe,
      await allowanceModule.setAllowance.populateTransaction(
        alice.address,
        tokenAddress,
        1000,
        0,
        0
      ),
      owner
    )

    expect(1000).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(bob.address))

    await execAllowanceTransfer(allowanceModule, {
      safe: safeAddress,
      token: tokenAddress,
      to: bob.address,
      amount: 100,
      spender: alice,
    })

    expect(await token.balanceOf(safeAddress)).to.equal(900)
    expect(await token.balanceOf(bob.address)).to.equal(100)

    // remove alice
    await execSafeTransaction(
      safe,
      await allowanceModule.removeDelegate.populateTransaction(
        alice.address,
        true
      ),
      owner
    )

    // does not work after removing delegate
    await expect(
      execAllowanceTransfer(allowanceModule, {
        safe: safeAddress,
        token: tokenAddress,
        to: bob.address,
        amount: 100,
        spender: alice,
      })
    ).to.be.revertedWith(
      'newSpent > allowance.spent && newSpent <= allowance.amount'
    )
  })

  it('Cannot set delegate without allowance configured', async () => {
    const { safe, allowanceModule, token, owner, alice, bob } =
      await loadFixture(setup)

    const safeAddress = await safe.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()
    const tokenAddress = await token.getAddress()

    expect(await safe.isModuleEnabled(allowanceAddress)).to.equal(true)

    // does not work without a delegate previously set
    await expect(
      execSafeTransaction(
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
    ).to.be.revertedWith('GS013')

    // does not work without an allowance
    await expect(
      execAllowanceTransfer(allowanceModule, {
        safe: safeAddress,
        token: tokenAddress,
        to: bob.address,
        amount: 10,
        spender: alice,
      })
    ).to.be.revertedWith(
      'newSpent > allowance.spent && newSpent <= allowance.amount'
    )

    expect(1000).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(bob.address))
  })
})
