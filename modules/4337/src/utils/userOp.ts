import { BigNumberish, BytesLike, Contract, Signer, ethers } from 'ethers'

import { SafeSignature } from './execution'

type OptionalExceptFor<T, TRequired extends keyof T = keyof T> = Partial<Pick<T, Exclude<keyof T, TRequired>>> &
  Required<Pick<T, TRequired>>

export interface UserOperation {
  sender: string
  nonce: string
  initCode: string
  callData: string
  callGasLimit: string
  verificationGasLimit: string
  preVerificationGas: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
  paymasterAndData: string
  signature: string
}

export interface SafeUserOperation {
  safe: string
  nonce: BigNumberish
  initCode: BytesLike
  callData: BytesLike
  callGasLimit: BigNumberish
  verificationGasLimit: BigNumberish
  preVerificationGas: BigNumberish
  maxFeePerGas: BigNumberish
  maxPriorityFeePerGas: BigNumberish
  paymasterAndData: BytesLike
  validAfter: BigNumberish
  validUntil: BigNumberish
  entryPoint: string
}

export const EIP712_SAFE_OPERATION_TYPE = {
  SafeOp: [
    { type: 'address', name: 'safe' },
    { type: 'uint256', name: 'nonce' },
    { type: 'bytes', name: 'initCode' },
    { type: 'bytes', name: 'callData' },
    { type: 'uint256', name: 'callGasLimit' },
    { type: 'uint256', name: 'verificationGasLimit' },
    { type: 'uint256', name: 'preVerificationGas' },
    { type: 'uint256', name: 'maxFeePerGas' },
    { type: 'uint256', name: 'maxPriorityFeePerGas' },
    { type: 'bytes', name: 'paymasterAndData' },
    { type: 'uint48', name: 'validAfter' },
    { type: 'uint48', name: 'validUntil' },
    { type: 'address', name: 'entryPoint' },
  ],
}

export const calculateSafeOperationHash = (erc4337ModuleAddress: string, safeOp: SafeUserOperation, chainId: BigNumberish): string => {
  return ethers.TypedDataEncoder.hash({ chainId, verifyingContract: erc4337ModuleAddress }, EIP712_SAFE_OPERATION_TYPE, safeOp)
}

export const calculateSafeOperationData = (erc4337ModuleAddress: string, safeOp: SafeUserOperation, chainId: BigNumberish): string => {
  return ethers.TypedDataEncoder.encode({ chainId, verifyingContract: erc4337ModuleAddress }, EIP712_SAFE_OPERATION_TYPE, safeOp)
}

export const signSafeOp = async (
  signer: Signer,
  moduleAddress: string,
  safeOp: SafeUserOperation,
  chainId: BigNumberish,
): Promise<SafeSignature> => {
  return {
    signer: await signer.getAddress(),
    data: await signer.signTypedData({ chainId, verifyingContract: moduleAddress }, EIP712_SAFE_OPERATION_TYPE, safeOp),
  }
}

export const buildSafeUserOp = (template: OptionalExceptFor<SafeUserOperation, 'safe' | 'nonce' | 'entryPoint'>): SafeUserOperation => {
  // use same maxFeePerGas and maxPriorityFeePerGas to ease testing prefund validation
  // otherwise it's tricky to calculate the prefund because of dynamic parameters like block.basefee
  // check UserOperation.sol#gasPrice()
  return {
    safe: template.safe,
    nonce: template.nonce,
    initCode: template.initCode ?? '0x',
    callData: template.callData ?? '0x',
    callGasLimit: template.callGasLimit ?? 2000000,
    verificationGasLimit: template.verificationGasLimit ?? 500000,
    preVerificationGas: template.preVerificationGas ?? 60000,
    // use same maxFeePerGas and maxPriorityFeePerGas to ease testing prefund validation
    // otherwise it's tricky to calculate the prefund because of dynamic parameters like block.basefee
    // check UserOperation.sol#gasPrice()
    maxFeePerGas: template.maxFeePerGas ?? 10000000000,
    maxPriorityFeePerGas: template.maxPriorityFeePerGas ?? 10000000000,
    paymasterAndData: template.paymasterAndData ?? '0x',
    validAfter: template.validAfter ?? 0,
    validUntil: template.validUntil ?? 0,
    entryPoint: template.entryPoint,
  }
}

export const buildSafeUserOpTransaction = (
  from: string,
  to: string,
  value: BigNumberish,
  data: string,
  nonce: BigNumberish,
  entryPoint: string,
  delegateCall?: boolean,
  bubbleUpRevertReason?: boolean,
  overrides?: Partial<SafeUserOperation>,
): SafeUserOperation => {
  const abi = [
    'function executeUserOp(address to, uint256 value, bytes calldata data, uint8 operation) external',
    'function executeUserOpWithErrorString(address to, uint256 value, bytes calldata data, uint8 operation) external',
  ]
  const method = bubbleUpRevertReason ? 'executeUserOpWithErrorString' : 'executeUserOp'
  const callData = new ethers.Interface(abi).encodeFunctionData(method, [to, value, data, delegateCall ? 1 : 0])

  return buildSafeUserOp(
    Object.assign(
      {
        safe: from,
        callData,
        nonce,
        entryPoint,
      },
      overrides,
    ),
  )
}

export const buildSafeUserOpContractCall = async (
  contract: Contract,
  method: string,
  params: unknown[],
  safeAddress: string,
  nonce: string,
  operationValue: string,
  entryPoint: string,
  delegateCall?: boolean,
  bubbleUpRevertReason?: boolean,
  overrides?: Partial<SafeUserOperation>,
): Promise<SafeUserOperation> => {
  const data = contract.interface.encodeFunctionData(method, params)

  return buildSafeUserOpTransaction(
    safeAddress,
    await contract.getAddress(),
    operationValue,
    data,
    nonce,
    entryPoint,
    delegateCall,
    bubbleUpRevertReason,
    overrides,
  )
}

export const buildUserOperationFromSafeUserOperation = ({
  safeOp,
  signature,
}: {
  safeOp: SafeUserOperation
  signature: string
}): UserOperation => {
  return {
    sender: safeOp.safe,
    nonce: ethers.toBeHex(safeOp.nonce),
    initCode: ethers.hexlify(safeOp.initCode),
    callData: ethers.hexlify(safeOp.callData),
    callGasLimit: ethers.toBeHex(safeOp.callGasLimit),
    verificationGasLimit: ethers.toBeHex(safeOp.verificationGasLimit),
    preVerificationGas: ethers.toBeHex(safeOp.preVerificationGas),
    maxFeePerGas: ethers.toBeHex(safeOp.maxFeePerGas),
    maxPriorityFeePerGas: ethers.toBeHex(safeOp.maxPriorityFeePerGas),
    paymasterAndData: ethers.hexlify(safeOp.paymasterAndData),
    signature: ethers.solidityPacked(['uint48', 'uint48', 'bytes'], [safeOp.validAfter, safeOp.validUntil, signature]),
  }
}

export const getRequiredGas = (userOp: UserOperation): string => {
  let multiplier = 3n
  if (userOp.paymasterAndData === '0x') {
    multiplier = 1n
  }

  return (BigInt(userOp.callGasLimit) + BigInt(userOp.verificationGasLimit) * multiplier + BigInt(userOp.preVerificationGas)).toString()
}

export const getRequiredPrefund = (userOp: UserOperation): string => {
  const requiredGas = getRequiredGas(userOp)
  const requiredPrefund = (BigInt(requiredGas) * BigInt(userOp.maxFeePerGas)).toString()
  console.log({ requiredGas, requiredPrefund })

  return requiredPrefund
}

export const getSupportedEntryPoints = async (provider: ethers.JsonRpcProvider): Promise<string[]> => {
  const supportedEntryPoints = await provider.send('eth_supportedEntryPoints', [])
  console.log({ supportedEntryPoints })
  return supportedEntryPoints.map(ethers.getAddress)
}

/**
 * Packs validation data into a string using the Ethereum ABI encoding.
 *
 * @param {BigNumberish} authorizer - The address of the authorizer. 0 for validation success, 1 for validation failure.
 * @param {BigNumberish} validUntil - The timestamp until which the validation remains valid.
 * @param {BigNumberish} validAfter - The timestamp when the validation becomes valid.
 * @returns {string} The packed validation data.
 */
export const packValidationData = (authorizer: BigNumberish, validUntil: BigNumberish, validAfter: BigNumberish): bigint => {
  const addrBigInt = BigInt(authorizer)
  const validUntilBigInt = BigInt(validUntil)
  const validAfterBigInt = BigInt(validAfter)

  const result = addrBigInt | (validUntilBigInt << BigInt(160)) | (validAfterBigInt << BigInt(160 + 48))

  return result
}
