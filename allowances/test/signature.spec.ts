import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import {
  AbiCoder,
  BigNumberish,
  keccak256,
  solidityPacked,
  toUtf8Bytes,
  ZeroAddress,
} from 'ethers'


import setup from './test-helpers/setup'

describe('signature', async () => {
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

    const {
      DOMAIN_SEPARATOR_TYPEHASH,
      ALLOWANCE_TRANSFER_TYPEHASH,
      transferHash,
    } = calculateTransferHash(
      allowanceAddress,
      (await alice.provider.getNetwork()).chainId,
      transfer
    )

    expect(await allowanceModule.DOMAIN_SEPARATOR_TYPEHASH()).to.equal(
      DOMAIN_SEPARATOR_TYPEHASH
    )

    expect(await allowanceModule.ALLOWANCE_TRANSFER_TYPEHASH()).to.equal(
      ALLOWANCE_TRANSFER_TYPEHASH
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
    ).to.equal(transferHash)
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
  const abi = AbiCoder.defaultAbiCoder()
  const DOMAIN_SEPARATOR_TYPEHASH = keccak256(
    toUtf8Bytes('EIP712Domain(uint256 chainId,address verifyingContract)')
  )
  const ALLOWANCE_TRANSFER_TYPEHASH = keccak256(
    toUtf8Bytes(
      'AllowanceTransfer(address safe,address token,address to,uint96 amount,address paymentToken,uint96 payment,uint16 nonce)'
    )
  )

  const domainSeparator = keccak256(
    abi.encode(
      ['bytes32', 'uint256', 'address'],
      [DOMAIN_SEPARATOR_TYPEHASH, chainId, verifyingContract]
    )
  )

  const transferHashData = keccak256(
    abi.encode(
      [
        'bytes32',
        'address',
        'address',
        'address',
        'uint96',
        'address',
        'uint96',
        'uint16',
      ],
      [
        ALLOWANCE_TRANSFER_TYPEHASH,
        safe,
        token,
        to,
        amount,
        paymentToken,
        payment,
        nonce,
      ]
    )
  )

  return {
    DOMAIN_SEPARATOR_TYPEHASH,
    ALLOWANCE_TRANSFER_TYPEHASH,
    domainSeparator,
    transferHashData,
    transferHash: keccak256(
      solidityPacked(
        ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
        ['0x19', '0x01', domainSeparator, transferHashData]
      )
    ),
  }
}
