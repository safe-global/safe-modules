import { ZeroAddress } from 'ethers'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

import { AllowanceModule } from '../../typechain-types'

export default async function execAllowanceTransfer(
  allowanceMod: AllowanceModule,
  {
    safe,
    token,
    to,
    amount,
    spender,
  }: {
    safe: string
    token: string
    to: string
    amount: number | bigint
    spender: SignerWithAddress
  }
) {
  const allowanceModAddress = await allowanceMod.getAddress()
  const chainId = await allowanceMod.getChainId()

  const [, , , , nonce] = await allowanceMod.getTokenAllowance(
    safe,
    spender.address,
    token
  )

  const { domain, types, message } = paramsToSign(
    allowanceModAddress,
    chainId,
    { safe, token, to, amount },
    nonce
  )

  const signature = await spender.signTypedData(domain, types, message)

  return allowanceMod.executeAllowanceTransfer(
    safe,
    token,
    to,
    amount,
    ZeroAddress, // paymentToken
    0, // payment
    spender.address,
    signature
  )
}

function paramsToSign(
  allowanceModAddress: string,
  chainId: bigint,
  {
    safe,
    token,
    to,
    amount,
  }: {
    safe: string
    token: string
    to: string
    amount: number | bigint
  },
  nonce: bigint
) {
  const domain = { chainId, verifyingContract: allowanceModAddress }
  const primaryType = 'AllowanceTransfer'
  const types = {
    AllowanceTransfer: [
      { type: 'address', name: 'safe' },
      { type: 'address', name: 'token' },
      { type: 'address', name: 'to' },
      { type: 'uint96', name: 'amount' },
      { type: 'address', name: 'paymentToken' },
      { type: 'uint96', name: 'payment' },
      { type: 'uint16', name: 'nonce' },
    ],
  }
  const message = {
    safe,
    token,
    to,
    amount,
    paymentToken: ZeroAddress,
    payment: 0,
    nonce,
  }

  return { domain, primaryType, types, message }
}
