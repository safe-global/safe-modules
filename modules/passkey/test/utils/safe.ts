import { BigNumberish, BytesLike } from 'ethers'
import { ethers } from 'hardhat'
import { Address } from 'hardhat-deploy/types'

export type SafeDomain = {
  verifyingContract: Address
  chainId: BigNumberish
}

export const buildSafeTransactionData = (domain: SafeDomain, safeTx: SafeTransaction): BytesLike => {
  return ethers.TypedDataEncoder.encode(
    domain,
    {
      SafeTx: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
        { name: 'safeTxGas', type: 'uint256' },
        { name: 'baseGas', type: 'uint256' },
        { name: 'gasPrice', type: 'uint256' },
        { name: 'gasToken', type: 'address' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    safeTx,
  )
}

export interface MetaTransaction {
  to: Address
  value: bigint
  data: BytesLike
  operation: number
}

export interface SafeTransaction extends MetaTransaction {
  safeTxGas: bigint
  baseGas: bigint
  gasPrice: bigint
  gasToken: Address
  refundReceiver: Address
  nonce: bigint
}

export const buildSafeTransaction = (template: {
  to: Address
  value?: bigint
  data?: BytesLike
  operation?: number
  safeTxGas?: bigint
  baseGas?: bigint
  gasPrice?: bigint
  gasToken?: Address
  refundReceiver?: Address
  nonce: bigint
}): SafeTransaction => {
  return {
    to: template.to,
    value: template.value || 0n,
    data: template.data || '0x',
    operation: template.operation || 0,
    safeTxGas: template.safeTxGas || 0n,
    baseGas: template.baseGas || 0n,
    gasPrice: template.gasPrice || 0n,
    gasToken: template.gasToken || ethers.ZeroAddress,
    refundReceiver: template.refundReceiver || ethers.ZeroAddress,
    nonce: template.nonce,
  }
}
