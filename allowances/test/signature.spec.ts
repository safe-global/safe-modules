import { expect } from 'chai'
import hre from 'hardhat'

import { BigNumberish } from 'ethers'
import {
  defaultAbiCoder,
  keccak256,
  solidityPack,
  toUtf8Bytes,
} from 'ethers/lib/utils'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import deploySingletons from './helpers/deploySingletons'

describe('AllowanceModule delegate', async () => {
  async function setup() {
    const [alice, bob, minter, deployer] = await hre.ethers.getSigners()

    const singletons = await deploySingletons(deployer)

    return {
      allowanceModule: singletons.allowanceModule,
      alice,
      bob,
    }
  }

  it('Generates expected transfer hash', async () => {
    const { allowanceModule, alice, bob } = await loadFixture(setup)

    const transfer = {
      safe: '0x1'.padEnd(42, '0'),
      token: '0x2'.padEnd(42, '0'),
      to: '0x3'.padEnd(42, '0'),
      amount: 12345,
      paymentToken: AddressZero,
      payment: 0,
      nonce: 0,
    }

    const {
      DOMAIN_SEPARATOR_TYPEHASH,
      ALLOWANCE_TRANSFER_TYPEHASH,
      domainSeparator,
      transferHashData,
      transferHash,
    } = calculateTransferHash(
      allowanceModule.address,
      await alice.getChainId(),
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
  chainId: number,
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
  const DOMAIN_SEPARATOR_TYPEHASH = keccak256(
    toUtf8Bytes('EIP712Domain(uint256 chainId,address verifyingContract)')
  )
  const ALLOWANCE_TRANSFER_TYPEHASH = keccak256(
    toUtf8Bytes(
      'AllowanceTransfer(address safe,address token,address to,uint96 amount,address paymentToken,uint96 payment,uint16 nonce)'
    )
  )

  const domainSeparator = keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'uint256', 'address'],
      [DOMAIN_SEPARATOR_TYPEHASH, chainId, verifyingContract]
    )
  )

  const transferHashData = keccak256(
    defaultAbiCoder.encode(
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
      solidityPack(
        ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
        ['0x19', '0x01', domainSeparator, transferHashData]
      )
    ),
  }
}

const AddressZero = '0x'.padEnd(42, '0')
const Bytes32Zero = '0x'.padEnd(66, '0')
