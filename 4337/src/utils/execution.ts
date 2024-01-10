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

export const buildSignatureBytes = (signatures: SafeSignature[]): string => {
  signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()))
  return ethers.concat(signatures.map((signature) => signature.data))
}

export const buildContractSignatureBytes = (signatures: SafeSignature[]): string => {
  const start = 65 * signatures.length
  const { segments } = signatures.reduce(
    ({ segments, offset }, { signer, data }) => {
      return {
        segments: [...segments, ethers.solidityPacked(['uint256', 'uint256', 'uint8'], [signer, start + offset, 0])],
        offset: offset + 32 + ethers.dataLength(data),
      }
    },
    { segments: [] as string[], offset: 0 },
  )
  return ethers.concat([
    ...segments,
    ...signatures.map(({ data }) => ethers.solidityPacked(['uint256', 'bytes'], [ethers.dataLength(data), data])),
  ])
}

export const logGas = async (message: string, tx: Promise<TransactionResponse>, skip?: boolean): Promise<TransactionResponse> => {
  return tx.then(async (result) => {
    const receipt = await result.wait()
    if (!receipt?.gasUsed) throw new Error('No gas used in receipt')

    if (!skip) console.log(`           Used ${receipt.gasUsed} gas for >${message}<`)
    return result
  })
}
