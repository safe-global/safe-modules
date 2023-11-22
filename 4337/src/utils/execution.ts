import { BigNumberish, Signer, TransactionResponse, ethers } from 'ethers'

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

export const buildSignatureBytes = (signatures: SafeSignature[], validAfter: BigNumberish = 0, validUntil: BigNumberish = 0): string => {
  signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()))
  const signatureBytes = ethers.concat(signatures.map((signature) => signature.data))
  const signatureWithTimestamps = ethers.solidityPacked(['uint48', 'uint48', 'bytes'], [validAfter ?? 0, validUntil ?? 0, signatureBytes])

  return signatureWithTimestamps
}

export const logGas = async (message: string, tx: Promise<TransactionResponse>, skip?: boolean): Promise<TransactionResponse> => {
  return tx.then(async (result) => {
    const receipt = await result.wait()
    if (!receipt?.gasUsed) throw new Error('No gas used in receipt')

    if (!skip) console.log(`           Used ${receipt.gasUsed} gas for >${message}<`)
    return result
  })
}
