import { Hex } from '@noble/curves/abstract/utils'
import { ethers } from 'hardhat'
import { Address } from 'hardhat-deploy/types'

const SAFE_TX_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    'SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)',
  ),
)

export const domainSeparatorTypehash = ethers.keccak256(ethers.toUtf8Bytes('EIP712Domain(uint256 chainId,address verifyingContract)'))

export const buildSafeTransactionData = (safeTx: SafeTransaction, domainSeparator: Hex): Hex => {
  const safeTxHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'uint256', 'bytes32', 'uint8', 'uint256', 'uint256', 'uint256', 'address', 'address', 'uint256'],
      [
        SAFE_TX_TYPEHASH,
        safeTx.to,
        safeTx.value,
        ethers.keccak256(safeTx.data),
        safeTx.operation,
        safeTx.safeTxGas,
        safeTx.baseGas,
        safeTx.gasPrice,
        safeTx.gasToken,
        safeTx.refundReceiver,
        safeTx.nonce,
      ],
    ),
  )
  return ethers.solidityPacked(['bytes1', 'bytes1', 'bytes32', 'bytes32'], ['0x19', '0x01', domainSeparator, safeTxHash])
}

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
