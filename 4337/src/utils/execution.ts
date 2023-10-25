import { BigNumberish, Contract, ContractTransaction, Signer, TransactionResponse, Wallet, ethers } from 'ethers'
import { Safe } from '../../typechain-types'

export const EIP_DOMAIN = {
  EIP712Domain: [
    { type: 'uint256', name: 'chainId' },
    { type: 'address', name: 'verifyingContract' },
  ],
}

export const EIP712_SAFE_MESSAGE_TYPE = {
  // "SafeMessage(bytes message)"
  SafeMessage: [{ type: 'bytes', name: 'message' }],
}

export interface MetaTransaction {
  to: string
  value: BigNumberish
  data: string
  operation: number
}

export interface SafeTransaction extends MetaTransaction {
  safeTxGas: string | number
  baseGas: string | number
  gasPrice: string | number
  gasToken: string
  refundReceiver: string
  nonce: string | number
}

export interface SafeSignature {
  signer: string
  data: string
}

export const signHash = async (signer: Signer, hash: string): Promise<SafeSignature> => {
  const typedDataHash = ethers.getBytes(hash)
  return {
    signer: await signer.getAddress(),
    data: await signer.signMessage(typedDataHash),
  }
}

export const buildSignatureBytes = (signatures: SafeSignature[]): string => {
  signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()))
  let signatureBytes = '0x'
  for (const sig of signatures) {
    signatureBytes += sig.data.slice(2)
  }
  return signatureBytes
}

export const logGas = async (message: string, tx: Promise<TransactionResponse>, skip?: boolean): Promise<TransactionResponse> => {
  return tx.then(async (result) => {
    const receipt = await result.wait()
    if (!skip) console.log(`           Used ${receipt!.gasUsed} gas for >${message}<`)
    return result
  })
}
