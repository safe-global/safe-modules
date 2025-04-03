import { expect } from 'chai'
import execAllowanceTransfer from './test-helpers/execAllowanceTransfer'
import execSafeTransaction from './test-helpers/execSafeTransaction'
import setup from './test-helpers/setup'
import { deployments } from 'hardhat'
import hre from 'hardhat'
import { ZeroAddress } from 'ethers'

describe('AllowanceModule allowanceManagement', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    return setup(deployments)
  })

  it('Revert when delegate addresses collide', async () => {
    const { safe, allowanceModule, owner, alice, bob } = await setupTests()

    // add alice as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)

    const collidingDelegateAddress = hre.ethers.getAddress(`0x${bob.address.slice(2, -12)}${alice.address.slice(-12)}`.toLowerCase())

    await expect(
      execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(collidingDelegateAddress), owner),
    ).to.be.revertedWith('GS013')

    await allowanceModule.connect(owner).addDelegate(alice.address)
    await expect(allowanceModule.connect(owner).addDelegate(collidingDelegateAddress)).to.be.revertedWith('currentDelegate == delegate')
  })

  it('setAllowance reverts when delegate address equals address(0)', async () => {
    const { token, allowanceModule } = await setupTests()

    const tokenAddress = await token.getAddress()

    await expect(allowanceModule.setAllowance(ZeroAddress, tokenAddress, 0, 0, 0)).to.be.revertedWith('delegate != address(0)')
  })

  it('addDelegate reverts when delegate address equals address(0)', async () => {
    const { allowanceModule } = await setupTests()

    await expect(allowanceModule.addDelegate(ZeroAddress)).to.be.revertedWith('index != uint(0)')
  })

  it('Do not emit event if delegate already added', async () => {
    const { safe, allowanceModule, owner, alice } = await setupTests()

    // add alice as delegate
    await expect(await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner))
      .to.emit(allowanceModule, 'AddDelegate')
      .withArgs(safe.target, alice.address)

    // add alice as delegate again
    await expect(await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)).to.not.emit(
      allowanceModule,
      'AddDelegate',
    )
  })

  it("Do not emit event if delegate doesn't exist when removing", async () => {
    const { safe, allowanceModule, owner, alice } = await setupTests()

    await expect(
      await execSafeTransaction(safe, await allowanceModule.removeDelegate.populateTransaction(alice.address, false), owner),
    ).to.not.emit(allowanceModule, 'AddDelegate')
  })

  it('Add delegates and removes first delegate', async () => {
    const { safe, allowanceModule, owner, alice, bob } = await setupTests()

    const safeAddress = await safe.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()

    expect(await safe.isModuleEnabled(allowanceAddress)).to.equal(true)

    // add alice as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)

    // add bob as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(bob.address), owner)

    let delegates = await allowanceModule.getDelegates(safeAddress, 0, 10)

    expect(delegates.results).to.deep.equal([bob.address, alice.address])
    expect(delegates.next).to.equal(0)

    // remove bob
    await execSafeTransaction(safe, await allowanceModule.removeDelegate.populateTransaction(bob.address, true), owner)
    delegates = await allowanceModule.getDelegates(safeAddress, 0, 10)

    expect(delegates.results).to.deep.equal([alice.address])
    expect(delegates.next).to.equal(0)
  })

  it('Add delegates and removes second delegate', async () => {
    const { safe, allowanceModule, owner, alice, bob } = await setupTests()

    const safeAddress = await safe.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()

    expect(await safe.isModuleEnabled.staticCall(allowanceAddress)).to.equal(true)

    // add alice as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)

    // add bob as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(bob.address), owner)

    let delegates = await allowanceModule.getDelegates(safeAddress, 0, 10)

    expect(delegates.results).to.deep.equal([bob.address, alice.address])
    expect(delegates.next).to.equal(0)

    // remove alice
    await execSafeTransaction(safe, await allowanceModule.removeDelegate.populateTransaction(alice.address, true), owner)
    delegates = await allowanceModule.getDelegates(safeAddress, 0, 10)

    expect(delegates.results).to.deep.equal([bob.address])
    expect(delegates.next).to.equal(0)
  })

  it('Add and remove delegate and then try to execute', async () => {
    const { safe, allowanceModule, token, owner, alice, bob } = await setupTests()

    const safeAddress = await safe.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()
    const tokenAddress = await token.getAddress()

    expect(await safe.isModuleEnabled(allowanceAddress)).to.equal(true)

    // add alice as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)

    // add allowance
    await execSafeTransaction(safe, await allowanceModule.setAllowance.populateTransaction(alice.address, tokenAddress, 1000, 0, 0), owner)

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
    await execSafeTransaction(safe, await allowanceModule.removeDelegate.populateTransaction(alice.address, true), owner)

    // does not work after removing delegate
    await expect(
      execAllowanceTransfer(allowanceModule, {
        safe: safeAddress,
        token: tokenAddress,
        to: bob.address,
        amount: 100,
        spender: alice,
      }),
    ).to.be.revertedWith('newSpent > allowance.spent && newSpent <= allowance.amount')
  })

  it('Cannot set delegate without allowance configured', async () => {
    const { safe, allowanceModule, token, owner, alice, bob } = await setupTests()

    const safeAddress = await safe.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()
    const tokenAddress = await token.getAddress()

    expect(await safe.isModuleEnabled(allowanceAddress)).to.equal(true)

    // does not work without a delegate previously set
    await expect(
      execSafeTransaction(safe, await allowanceModule.setAllowance.populateTransaction(alice.address, tokenAddress, 100, 0, 0), owner),
    ).to.be.revertedWith('GS013')

    // does not work without an allowance
    await expect(
      execAllowanceTransfer(allowanceModule, {
        safe: safeAddress,
        token: tokenAddress,
        to: bob.address,
        amount: 10,
        spender: alice,
      }),
    ).to.be.revertedWith('newSpent > allowance.spent && newSpent <= allowance.amount')

    expect(1000).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(bob.address))
  })

  it('Add and reset allowance', async () => {
    const { safe, allowanceModule, token, owner, alice, bob } = await setupTests()

    const safeAddress = await safe.getAddress()
    const tokenAddress = await token.getAddress()

    // add alice as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)

    // add allowance
    await execSafeTransaction(safe, await allowanceModule.setAllowance.populateTransaction(alice.address, tokenAddress, 500, 0, 0), owner)

    expect(1000).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(bob.address))

    await execAllowanceTransfer(allowanceModule, {
      safe: safeAddress,
      token: tokenAddress,
      to: bob.address,
      amount: 500,
      spender: alice,
    })

    expect(await token.balanceOf(safeAddress)).to.equal(500)
    expect(await token.balanceOf(bob.address)).to.equal(500)

    // reset alice's allowance
    await expect(
      await execSafeTransaction(safe, await allowanceModule.resetAllowance.populateTransaction(alice.address, tokenAddress), owner),
    )
      .to.emit(allowanceModule, 'ResetAllowance')
      .withArgs(safeAddress, alice.address, tokenAddress)

    await execAllowanceTransfer(allowanceModule, {
      safe: safeAddress,
      token: tokenAddress,
      to: bob.address,
      amount: 500,
      spender: alice,
    })

    expect(await token.balanceOf(safeAddress)).to.equal(0)
    expect(await token.balanceOf(bob.address)).to.equal(1000)
  })

  it('Add and delete allowance', async () => {
    const { safe, allowanceModule, token, owner, alice, bob } = await setupTests()

    const safeAddress = await safe.getAddress()
    const tokenAddress = await token.getAddress()

    // add alice as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)

    // add allowance
    await execSafeTransaction(safe, await allowanceModule.setAllowance.populateTransaction(alice.address, tokenAddress, 500, 0, 0), owner)

    expect(1000).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(bob.address))

    // delete alice's allowance
    await expect(
      await execSafeTransaction(safe, await allowanceModule.deleteAllowance.populateTransaction(alice.address, tokenAddress), owner),
    )
      .to.emit(allowanceModule, 'DeleteAllowance')
      .withArgs(safeAddress, alice.address, tokenAddress)

    // does not work without an allowance
    await expect(
      execAllowanceTransfer(allowanceModule, {
        safe: safeAddress,
        token: tokenAddress,
        to: bob.address,
        amount: 500,
        spender: alice,
      }),
    ).to.be.revertedWith('newSpent > allowance.spent && newSpent <= allowance.amount')

    expect(await token.balanceOf(safeAddress)).to.equal(1000)
    expect(await token.balanceOf(bob.address)).to.equal(0)
  })

  it('Use allowance with payment in same token', async () => {
    const { safe, allowanceModule, token, owner, alice, bob, charlie } = await setupTests()

    const safeAddress = await safe.getAddress()
    const tokenAddress = await token.getAddress()

    // add alice as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)

    // add allowance
    await execSafeTransaction(safe, await allowanceModule.setAllowance.populateTransaction(alice.address, tokenAddress, 100, 0, 0), owner)

    expect(1000).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(bob.address))
    expect(0).to.equal(await token.balanceOf(charlie.address))

    await execAllowanceTransfer(allowanceModule.connect(charlie), {
      safe: safeAddress,
      token: tokenAddress,
      to: bob.address,
      amount: 99,
      spender: alice,
      paymentToken: tokenAddress,
      payment: 1,
    })

    expect(await token.balanceOf(safeAddress)).to.equal(900)
    expect(await token.balanceOf(bob.address)).to.equal(99)
    expect(await token.balanceOf(charlie.address)).to.equal(1)
  })

  it('Use allowance with payment in different token', async () => {
    const { safe, allowanceModule, token, owner, alice, bob, charlie } = await setupTests()

    const safeAddress = await safe.getAddress()
    const tokenAddress = await token.getAddress()
    const paymentToken = await (await hre.ethers.getContractFactory('TestToken')).deploy()
    await paymentToken.mint(safeAddress, 1000)
    const paymentTokenAddress = await paymentToken.getAddress()

    // add alice as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)

    // add allowance
    await execSafeTransaction(safe, await allowanceModule.setAllowance.populateTransaction(alice.address, tokenAddress, 100, 0, 0), owner)
    // add allowance for payment in native token
    await execSafeTransaction(
      safe,
      await allowanceModule.setAllowance.populateTransaction(alice.address, paymentTokenAddress, 200, 0, 0),
      owner,
    )

    expect(1000).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(bob.address))
    expect(0).to.equal(await paymentToken.balanceOf(charlie.address))

    await execAllowanceTransfer(allowanceModule.connect(charlie), {
      safe: safeAddress,
      token: tokenAddress,
      to: bob.address,
      amount: 99,
      spender: alice,
      paymentToken: paymentTokenAddress,
      payment: 200,
    })

    expect(await token.balanceOf(safeAddress)).to.equal(901)
    expect(await token.balanceOf(bob.address)).to.equal(99)
    expect(await paymentToken.balanceOf(safeAddress)).to.equal(800)
  })

  it('Revert when sum(payment, transfer amount) exceeds allowance amount', async () => {
    const { safe, allowanceModule, token, owner, alice, bob, charlie } = await setupTests()

    const safeAddress = await safe.getAddress()
    const tokenAddress = await token.getAddress()

    // add alice as delegate
    await execSafeTransaction(safe, await allowanceModule.addDelegate.populateTransaction(alice.address), owner)

    // add allowance
    await execSafeTransaction(safe, await allowanceModule.setAllowance.populateTransaction(alice.address, tokenAddress, 100, 0, 0), owner)

    expect(1000).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(bob.address))
    expect(0).to.equal(await token.balanceOf(charlie.address))

    await expect(
      execAllowanceTransfer(allowanceModule.connect(charlie), {
        safe: safeAddress,
        token: tokenAddress,
        to: bob.address,
        amount: 100,
        spender: alice,
        paymentToken: tokenAddress,
        payment: 1,
      }),
    ).to.be.revertedWith('newSpent > paymentAllowance.spent && newSpent <= paymentAllowance.amount')

    expect(await token.balanceOf(safeAddress)).to.equal(1000)
    expect(await token.balanceOf(bob.address)).to.equal(0)
    expect(await token.balanceOf(charlie.address)).to.equal(0)
  })
})
