import { TransactionRequest } from 'ethers'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { ISafe } from '../../typechain-types'

export default async function execTransaction(
  safe: ISafe,
  { to, data, value = 0 }: TransactionRequest,
  signer: SignerWithAddress
) {
  const safeAddress = await safe.getAddress()
  const chainId = await safe.getChainId()
  const nonce = await safe.nonce()

  const { domain, types, message } = paramsToSign(
    safeAddress,
    chainId,
    { to, data, value },
    nonce
  )

  const signature = await signer.signTypedData(domain, types, message)

  return safe.execTransaction(
    to as string,
    value as number | bigint,
    data as string,
    0, // operation
    0,
    0,
    0,
    AddressZero,
    AddressZero,
    signature
  )
}

function paramsToSign(
  safeAddress: string,
  chainId: bigint,
  { to, data, value }: TransactionRequest,
  nonce: bigint | number
) {
  const domain = { verifyingContract: safeAddress, chainId }
  const primaryType = 'SafeTx' as const
  const types = {
    SafeTx: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'value' },
      { type: 'bytes', name: 'data' },
      { type: 'uint8', name: 'operation' },
      { type: 'uint256', name: 'safeTxGas' },
      { type: 'uint256', name: 'baseGas' },
      { type: 'uint256', name: 'gasPrice' },
      { type: 'address', name: 'gasToken' },
      { type: 'address', name: 'refundReceiver' },
      { type: 'uint256', name: 'nonce' },
    ],
  }
  const message = {
    to,
    value,
    data,
    operation: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: AddressZero,
    refundReceiver: AddressZero,
    nonce,
  }

  return { domain, primaryType, types, message }
}

const AddressZero = '0x'.padEnd(42, '0')
