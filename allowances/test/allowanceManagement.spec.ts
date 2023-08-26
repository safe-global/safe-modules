import hre from 'hardhat'
import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { TestToken, TestToken__factory } from '../typechain-types'

import deploySingletons from './helpers/deploySingletons'
import deploySafeProxy from './helpers/deploySafeProxy'
import execTransaction from './helpers/execTransaction'
import execAllowanceTransfer from './helpers/execAllowanceTransfer'

describe('AllowanceModule allowanceManagement', async () => {
  async function setup() {
    const [owner, alice, bob, spender, receiver, deployer] =
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

  before(
    async () => await hre.network.provider.request({ method: 'hardhat_reset' })
  )

  it('Add delegates and removes first delegate', async () => {
    const { allowanceModule, safe, owner, alice, bob } = await loadFixture(
      setup
    )

    expect(await safe.isModuleEnabled(allowanceModule.address)).to.equal(true)

    // add alice as delegate
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.addDelegate(alice.address),
      owner
    )

    // add bob as delegate
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.addDelegate(bob.address),
      owner
    )

    let delegates = await allowanceModule.getDelegates(safe.address, 0, 10)

    expect(delegates.results).to.deep.equal([bob.address, alice.address])
    expect(delegates.next).to.equal(0)

    // remove bob
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.removeDelegate(
        bob.address,
        true
      ),
      owner
    )
    delegates = await allowanceModule.getDelegates(safe.address, 0, 10)

    expect(delegates.results).to.deep.equal([alice.address])
    expect(delegates.next).to.equal(0)
  })

  it('Add delegates and removes second delegate', async () => {
    const { allowanceModule, safe, owner, alice, bob } = await loadFixture(
      setup
    )

    expect(await safe.isModuleEnabled(allowanceModule.address)).to.equal(true)

    // add alice as delegate
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.addDelegate(alice.address),
      owner
    )

    // add bob as delegate
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.addDelegate(bob.address),
      owner
    )

    let delegates = await allowanceModule.getDelegates(safe.address, 0, 10)

    expect(delegates.results).to.deep.equal([bob.address, alice.address])
    expect(delegates.next).to.equal(0)

    // remove alice
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.removeDelegate(
        alice.address,
        true
      ),
      owner
    )
    delegates = await allowanceModule.getDelegates(safe.address, 0, 10)

    expect(delegates.results).to.deep.equal([bob.address])
    expect(delegates.next).to.equal(0)
  })

  it('Add and remove delegate and then try to execute', async () => {
    const { allowanceModule, safe, token, owner, spender, receiver } =
      await loadFixture(setup)

    expect(await safe.isModuleEnabled(allowanceModule.address)).to.equal(true)

    // add alice as delegate
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.addDelegate(spender.address),
      owner
    )

    // add allowance
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.setAllowance(
        spender.address,
        token.address,
        1000,
        0,
        0
      ),
      owner
    )

    expect(await token.balanceOf(safe.address)).to.equal(1000)
    expect(await token.balanceOf(receiver.address)).to.equal(0)

    await execAllowanceTransfer(allowanceModule, {
      safe: safe.address,
      token: token.address,
      to: receiver.address,
      amount: 100,
      spender,
    })

    expect(await token.balanceOf(safe.address)).to.equal(900)
    expect(await token.balanceOf(receiver.address)).to.equal(100)

    // remove alice
    await execTransaction(
      safe,
      await allowanceModule.populateTransaction.removeDelegate(
        spender.address,
        true
      ),
      owner
    )

    // does not work after removing delegate
    await expect(
      execAllowanceTransfer(allowanceModule, {
        safe: safe.address,
        token: token.address,
        to: receiver.address,
        amount: 100,
        spender,
      })
    ).to.be.revertedWith(
      'newSpent > allowance.spent && newSpent <= allowance.amount'
    )
  })

  it('Cannot set delegate without allowance configured', async () => {
    const { allowanceModule, safe, token, owner, spender, receiver } =
      await loadFixture(setup)

    expect(await safe.isModuleEnabled(allowanceModule.address)).to.equal(true)

    // does not work without a delegate previously set
    await expect(
      execTransaction(
        safe,
        await allowanceModule.populateTransaction.setAllowance(
          spender.address,
          token.address,
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
        safe: safe.address,
        token: token.address,
        to: receiver.address,
        amount: 10,
        spender,
      })
    ).to.be.revertedWith(
      'newSpent > allowance.spent && newSpent <= allowance.amount'
    )

    expect(await token.balanceOf(safe.address)).to.equal(1000)
    expect(await token.balanceOf(receiver.address)).to.equal(0)
  })
})

async function deployTestToken(minter: SignerWithAddress): Promise<TestToken> {
  const factory: TestToken__factory = await hre.ethers.getContractFactory(
    'TestToken',
    minter
  )
  return await factory.connect(minter).deploy()
}
