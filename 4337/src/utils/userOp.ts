import { BigNumberish, Contract, Signer, ethers } from 'ethers'

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
  callData: string
  nonce: string
  preVerificationGas: string
  verificationGasLimit: string
  callGasLimit: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
  entryPoint: string
}

export const EIP712_SAFE_OPERATION_TYPE = {
  // "SafeOp(address safe,bytes callData,uint256 nonce,uint256 preVerificationGas,uint256 verificationGasLimit,uint256 callGasLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,address entryPoint)"
  SafeOp: [
    { type: 'address', name: 'safe' },
    { type: 'bytes', name: 'callData' },
    { type: 'uint256', name: 'nonce' },
    { type: 'uint256', name: 'preVerificationGas' },
    { type: 'uint256', name: 'verificationGasLimit' },
    { type: 'uint256', name: 'callGasLimit' },
    { type: 'uint256', name: 'maxFeePerGas' },
    { type: 'uint256', name: 'maxPriorityFeePerGas' },
    { type: 'address', name: 'entryPoint' },
  ],
}

export const calculateSafeOperationHash = (eip4337ModuleAddress: string, safeOp: SafeUserOperation, chainId: BigNumberish): string => {
  return ethers.TypedDataEncoder.hash({ chainId, verifyingContract: eip4337ModuleAddress }, EIP712_SAFE_OPERATION_TYPE, safeOp)
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
    entryPoint: template.entryPoint,
    callData: template.callData || '0x',
    verificationGasLimit: template.verificationGasLimit || '500000',
    preVerificationGas: template.preVerificationGas || '60000',
    callGasLimit: template.callGasLimit || '2000000',
    maxFeePerGas: template.maxFeePerGas || '10000000000',
    maxPriorityFeePerGas: template.maxPriorityFeePerGas || '10000000000',
  }
}

export const buildSafeUserOpTransaction = (
  from: string,
  to: string,
  value: BigNumberish,
  data: string,
  nonce: string,
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
  initCode = '0x',
}: {
  safeAddress: string
  safeOp: SafeUserOperation
  signature: string
  initCode?: string
}): UserOperation => {
  return {
    nonce: ethers.toBeHex(safeOp.nonce),
    callData: safeOp.callData || '0x',
    verificationGasLimit: ethers.toBeHex(safeOp.verificationGasLimit || '300000'),
    preVerificationGas: ethers.toBeHex(safeOp.preVerificationGas || '50000'),
    callGasLimit: ethers.toBeHex(safeOp.callGasLimit || '2000000'),
    // use same maxFeePerGas and maxPriorityFeePerGas to ease testing prefund validation
    // otherwise it's tricky to calculate the prefund because of dynamic parameters like block.basefee
    // check UserOperation.sol#gasPrice()
    maxFeePerGas: ethers.toBeHex(safeOp.maxFeePerGas || '5000000000'),
    maxPriorityFeePerGas: ethers.toBeHex(safeOp.maxPriorityFeePerGas || '1500000000'),
    initCode,
    paymasterAndData: '0x',
    sender: safeOp.safe,
    signature: signature,
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
