import { ethers } from 'hardhat'

export interface MetaTransaction {
  to: string
  value: bigint
  data: string
  operation: number
}

export interface SafeTransaction extends MetaTransaction {
  safeTxGas: bigint
  baseGas: bigint
  gasPrice: bigint
  gasToken: string
  refundReceiver: string
  nonce: bigint
}

export const buildSafeTransaction = (template: {
  to: string
  value?: bigint
  data?: string
  operation?: number
  safeTxGas?: bigint
  baseGas?: bigint
  gasPrice?: bigint
  gasToken?: string
  refundReceiver?: string
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
