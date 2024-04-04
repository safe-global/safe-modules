import { Hex } from '@noble/curves/abstract/utils'
import { ethers } from 'hardhat'
import { Address } from 'hardhat-deploy/types'

export interface MetaTransaction {
  to: Address
  value: bigint
  data: Hex
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
  data?: Hex
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
