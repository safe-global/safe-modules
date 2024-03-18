import { encodePacked, encodeFunctionData, Address } from 'viem'
import { MULTISEND_ABI } from './abi'

export type InternalTx = {
  to: Address
  data: `0x${string}`
  value: bigint
  operation: 0 | 1
}

const encodeInternalTransaction = (tx: InternalTx): string => {
  const encoded = encodePacked(
    ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
    [tx.operation, tx.to, tx.value, BigInt(tx.data.slice(2).length / 2), tx.data],
  )
  return encoded.slice(2)
}

export const encodeMultiSend = (txs: InternalTx[]): `0x${string}` => {
  const data: `0x${string}` = `0x${txs.map((tx) => encodeInternalTransaction(tx)).join('')}`

  return encodeFunctionData({
    abi: MULTISEND_ABI,
    functionName: 'multiSend',
    args: [data],
  })
}
