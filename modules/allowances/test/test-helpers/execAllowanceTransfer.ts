import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { ZeroAddress } from 'ethers'

import { AllowanceModule } from '../../typechain-types'

export default async function execAllowanceTransfer(
  module: AllowanceModule,
  {
    safe,
    token,
    to,
    amount,
    spender,
    paymentToken = ZeroAddress,
    payment = 0,
  }: {
    safe: string
    token: string
    to: string
    amount: number | bigint
    spender: SignerWithAddress
    paymentToken?: string
    payment?: number | bigint
  },
) {
  const address = await module.getAddress()
  const chainId = await module.getChainId()

  const [, , , , nonce] = await module.getTokenAllowance(safe, spender.address, token)

  const { domain, types, message } = paramsToSign(address, chainId, { safe, token, to, amount, paymentToken, payment }, nonce)

  const signature = await spender.signTypedData(domain, types, message)

  return module.executeAllowanceTransfer(safe, token, to, amount, paymentToken, payment, spender.address, signature)
}

function paramsToSign(
  address: string,
  chainId: bigint,
  {
    safe,
    token,
    to,
    amount,
    paymentToken = ZeroAddress,
    payment = 0,
  }: {
    safe: string
    token: string
    to: string
    amount: number | bigint
    paymentToken?: string
    payment?: number | bigint
  },
  nonce: bigint,
) {
  const domain = { chainId, verifyingContract: address }
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
    paymentToken,
    payment,
    nonce,
  }

  return { domain, primaryType, types, message }
}
