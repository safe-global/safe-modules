import { BigNumberish, Signer, TransactionResponse, ethers } from 'ethers'
import { IEntryPoint } from '../../typechain-types'

export const EIP_DOMAIN = {
  EIP712Domain: [
    { type: 'uint256', name: 'chainId' },
    { type: 'address', name: 'verifyingContract' },
  ],
}

export const EIP712_SAFE_TX_TYPE = {
  // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
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

export interface SignedSafeTransaction extends SafeTransaction {
  signatures: SafeSignature[]
}

export interface SafeSignature {
  signer: string
  data: string
  // a flag to indicate if the signature is a contract signature and the data has to be appended to the dynamic part of signature bytes
  dynamic?: true
}

export const calculateSafeDomainSeparator = (safeAddress: string, chainId: BigNumberish): string => {
  return ethers.TypedDataEncoder.hashDomain({ verifyingContract: safeAddress, chainId })
}

export const preimageSafeTransactionHash = (safeAddress: string, safeTx: SafeTransaction, chainId: BigNumberish): string => {
  return ethers.TypedDataEncoder.encode({ verifyingContract: safeAddress, chainId }, EIP712_SAFE_TX_TYPE, safeTx)
}

export const calculateSafeTransactionHash = (safeAddress: string, safeTx: SafeTransaction, chainId: BigNumberish): string => {
  return ethers.TypedDataEncoder.hash({ verifyingContract: safeAddress, chainId }, EIP712_SAFE_TX_TYPE, safeTx)
}

export const preimageSafeMessageHash = (safeAddress: string, message: string, chainId: BigNumberish): string => {
  return ethers.TypedDataEncoder.encode({ verifyingContract: safeAddress, chainId }, EIP712_SAFE_MESSAGE_TYPE, { message })
}

export const calculateSafeMessageHash = (safeAddress: string, message: string, chainId: BigNumberish): string => {
  return ethers.TypedDataEncoder.hash({ verifyingContract: safeAddress, chainId }, EIP712_SAFE_MESSAGE_TYPE, { message })
}

export const signHash = async (signer: Signer, hash: string): Promise<SafeSignature> => {
  const typedDataHash = ethers.getBytes(hash)
  const signerAddress = await signer.getAddress()
  const signature = await signer.signMessage(typedDataHash)

  return {
    signer: signerAddress,
    data: signature.replace(/1b$/, '1f').replace(/1c$/, '20'),
  }
}

export const getPrevalidatedSignature = (signerAddress: string): SafeSignature => {
  return {
    signer: signerAddress,
    data: '0x000000000000000000000000' + signerAddress.slice(2) + '0000000000000000000000000000000000000000000000000000000000000000' + '01',
  }
}

export const buildContractSignature = (signerAddress: string, signature: string): SafeSignature => {
  return {
    signer: signerAddress,
    data: signature,
    dynamic: true,
  }
}

export const buildSignatureBytes = (signatures: SafeSignature[]): string => {
  const SIGNATURE_LENGTH_BYTES = 65
  signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()))

  let signatureBytes = '0x'
  let dynamicBytes = ''
  for (const sig of signatures) {
    if (sig.dynamic) {
      /* 
              A contract signature has a static part of 65 bytes and the dynamic part that needs to be appended 
              at the end of signature bytes.
              The signature format is
              Signature type == 0
              Constant part: 65 bytes
              {32-bytes signature verifier}{32-bytes dynamic data position}{1-byte signature type}
              Dynamic part (solidity bytes): 32 bytes + signature data length
              {32-bytes signature length}{bytes signature data}
          */
      const dynamicPartPosition = (signatures.length * SIGNATURE_LENGTH_BYTES + dynamicBytes.length / 2).toString(16).padStart(64, '0')
      const dynamicPartLength = (sig.data.slice(2).length / 2).toString(16).padStart(64, '0')
      const staticSignature = `${sig.signer.slice(2).padStart(64, '0')}${dynamicPartPosition}00`
      const dynamicPartWithLength = `${dynamicPartLength}${sig.data.slice(2)}`

      signatureBytes += staticSignature
      dynamicBytes += dynamicPartWithLength
    } else {
      signatureBytes += sig.data.slice(2)
    }
  }

  return signatureBytes + dynamicBytes
}

export const logGas = async (message: string, tx: Promise<TransactionResponse>, skip?: boolean): Promise<TransactionResponse> => {
  return tx.then(async (result) => {
    const receipt = await result.wait()

    if (!receipt?.gasUsed) throw new Error('No gas used in receipt')

    if (!skip) console.log(`           Used ${receipt.gasUsed} gas for >${message}<`)
    return result
  })
}

type UserOperationGasLog = {
  actualGasUsed: bigint
  actualGasCost: bigint
  transactionResponse: TransactionResponse
}

/**
 * Logs the gas used by a user operation and returns the gas log.
 *
 * @param message - The message associated with the user operation.
 * @param entryPoint - The entry point object.
 * @param tx - The transaction promise.
 * @param skip - Optional flag to skip logging.
 * @returns {UserOperationGasLog} A promise that resolves to the user operation gas log.
 * @throws An error if the receipt is not available, gas used is not available in the receipt,
 * gas used or gas cost is not available in the UserOperationEvent, or UserOperationEvent is not emitted.
 */
export const logUserOperationGas = async (
  message: string,
  entryPoint: IEntryPoint,
  tx: Promise<TransactionResponse>,
  skip?: boolean,
): Promise<UserOperationGasLog> => {
  return tx.then(async (transactionResponse) => {
    const receipt = await transactionResponse.wait()
    if (!receipt) throw new Error('No receipt')

    const userOperationEvent = await entryPoint.queryFilter(entryPoint.filters.UserOperationEvent(), receipt.blockNumber)
    const parsedUserOperationEvent = entryPoint.interface.parseLog(userOperationEvent[0])

    if (!receipt?.gasUsed) throw new Error('No gas used in receipt')
    if (!parsedUserOperationEvent?.args.actualGasUsed || !parsedUserOperationEvent?.args.actualGasCost)
      throw new Error('No gas used or gas cost in UserOperationEvent or UserOperationEvent not emitted')

    if (!skip) {
      console.log(`           Used ${parsedUserOperationEvent.args.actualGasUsed} gas (Account or Paymaster) for >${message}<`)
      console.log(`           Used ${receipt.gasUsed} gas (Transaction) for >${message}<`)
    }
    return {
      actualGasUsed: parsedUserOperationEvent.args.actualGasUsed,
      actualGasCost: parsedUserOperationEvent.args.actualGasCost,
      transactionResponse,
    }
  })
}
