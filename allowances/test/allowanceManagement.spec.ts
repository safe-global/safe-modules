import hre from 'hardhat'
import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import deploySingletons from './helpers/deploySingletons'
import deploySafeProxy from './helpers/deploySafeProxy'
import execTransaction from './helpers/execTransaction'

describe('AllowanceModule delegate', async () => {
  async function setup() {
    const [owner, alice, bob] = await hre.ethers.getSigners()

    const singletons = await deploySingletons(bob)

    const safe = await deploySafeProxy(owner, singletons)

    return { ...singletons, safe, owner, alice, bob }
  }
  it('Add delegates and remove first delegate', async () => {
    const { allowanceModule, safe, owner, alice, bob } = await loadFixture(
      setup
    )

    // enable Allowance as mod
    await execTransaction(
      safe,
      {
        to: safe.address,
        data: safe.interface.encodeFunctionData('enableModule', [
          allowanceModule.address,
        ]),
      },
      owner
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

    const { results, next } = await allowanceModule.getDelegates(
      safe.address,
      0,
      10
    )

    expect(results).to.deep.equal([bob.address, alice.address])
    expect(next).to.equal(0)
  })
})

const AddressZero = '0x'.padEnd(42, '0')
const Bytes32Zero = '0x'.padEnd(66, '0')
