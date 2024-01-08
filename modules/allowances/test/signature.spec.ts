import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { BigNumberish, TypedDataEncoder, ZeroAddress } from 'ethers'

import setup from './test-helpers/setup'

describe('signature', () => {
  it('Generates expected transfer hash', async () => {
    const { allowanceModule, alice } = await loadFixture(setup)

    const allowanceAddress = await allowanceModule.getAddress()

    const transfer = {
      safe: '0x0000000000000000000000000000000000000010',
      token: '0x0000000000000000000000000000000000000020',
      to: '0x0000000000000000000000000000000000000030',
      amount: 12345,
      paymentToken: ZeroAddress,
      payment: 0,
      nonce: 0,
    }

    const hash = calculateTransferHash(
      allowanceAddress,
      (await alice.provider.getNetwork()).chainId,
      transfer
    )

    expect(
      await allowanceModule.generateTransferHash(
        transfer.safe,
        transfer.token,
        transfer.to,
        transfer.amount,
        transfer.paymentToken,
        transfer.payment,
        transfer.nonce
      )
    ).to.equal(hash)
  })
})

function calculateTransferHash(
  verifyingContract: string,
  chainId: number | bigint,
  {
    safe,
    token,
    to,
    amount,
    paymentToken,
    payment,
    nonce,
  }: {
    safe: string
    token: string
    to: string
    amount: BigNumberish
    paymentToken: string
    payment: BigNumberish
    nonce: BigNumberish
  }
) {
  const types = {
    AllowanceTransfer: [
      {
        name: 'safe',
        type: 'address',
      },
      {
        name: 'token',
        type: 'address',
      },
      {
        name: 'to',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint96',
      },
      {
        name: 'paymentToken',
        type: 'address',
      },
      {
        name: 'payment',
        type: 'uint96',
      },
      {
        name: 'nonce',
        type: 'uint16',
      },
    ],
  }

  const values = {
    safe,
    token,
    to,
    amount,
    paymentToken,
    payment,
    nonce,
  }

  const hash = TypedDataEncoder.hash(
    { verifyingContract, chainId },
    types,
    values
  )

  return hash
}
