import { UserOperation } from '@safe-global/safe-4337-provider'
import { BigNumberish, BytesLike, Contract, Signer, ethers } from 'ethers'
import { PackedUserOperationStruct as PackedUserOperation } from '../../typechain-types/contracts/Safe4337Module'
import { SafeSignature } from './execution'

export { PackedUserOperation, UserOperation }

type OptionalExceptFor<T, TRequired extends keyof T = keyof T> = Partial<Pick<T, Exclude<keyof T, TRequired>>> &
  Required<Pick<T, TRequired>>

export const PLACEHOLDER_SIGNATURE =
  '0x9c8ecb7ad80d2dd4411c8827079cda17095236ee3cba1c9b81153d52af17bc9d0701228dc95a75136a3e3a0130988ba4053cc15d3805db49e2cc08d9c99562191b'

export type SafeUserOperation = {
  safe: string
  entryPoint: string
  validAfter: BigNumberish
  validUntil: BigNumberish
} & GasParameters &
  Omit<PackedUserOperation, 'sender' | 'signature' | keyof PackedGasParameters>

export const EIP712_SAFE_OPERATION_TYPE = {
  SafeOp: [
    { type: 'address', name: 'safe' },
    { type: 'uint256', name: 'nonce' },
    { type: 'bytes', name: 'initCode' },
    { type: 'bytes', name: 'callData' },
    { type: 'uint128', name: 'verificationGasLimit' },
    { type: 'uint128', name: 'callGasLimit' },
    { type: 'uint256', name: 'preVerificationGas' },
    { type: 'uint128', name: 'maxPriorityFeePerGas' },
    { type: 'uint128', name: 'maxFeePerGas' },
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
    verificationGasLimit: template.verificationGasLimit ?? 500000,
    callGasLimit: template.callGasLimit ?? 2000000,
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

export const buildPackedUserOperationFromSafeUserOperation = ({
  safeOp,
  signature,
}: {
  safeOp: SafeUserOperation
  signature: string
}): PackedUserOperation => {
  return {
    sender: safeOp.safe,
    nonce: ethers.toBeHex(safeOp.nonce),
    initCode: ethers.hexlify(safeOp.initCode),
    callData: ethers.hexlify(safeOp.callData),
    preVerificationGas: ethers.toBeHex(safeOp.preVerificationGas),
    ...packGasParameters(safeOp),
    paymasterAndData: ethers.hexlify(safeOp.paymasterAndData),
    signature: ethers.solidityPacked(['uint48', 'uint48', 'bytes'], [safeOp.validAfter, safeOp.validUntil, signature]),
  }
}

export const buildRpcUserOperationFromSafeUserOperation = (op: {
  safeOp: SafeUserOperation
  signature: string
}): Promise<UserOperation> => {
  return unpackUserOperation(buildPackedUserOperationFromSafeUserOperation(op))
}

export const getRequiredGas = (userOp: PackedUserOperation): string => {
  let multiplier = 3n
  if (userOp.paymasterAndData === '0x') {
    multiplier = 1n
  }
  const { verificationGasLimit, callGasLimit } = unpackGasParameters(userOp)

  return (BigInt(callGasLimit) + BigInt(verificationGasLimit) * multiplier + BigInt(userOp.preVerificationGas)).toString()
}

export const getRequiredPrefund = (userOp: PackedUserOperation): bigint => {
  const requiredGas = getRequiredGas(userOp)
  const { maxFeePerGas } = unpackGasParameters(userOp)
  const requiredPrefund = BigInt(requiredGas) * BigInt(maxFeePerGas)

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

  const result = addrBigInt | (validUntilBigInt << 160n) | (validAfterBigInt << (160n + 48n))

  return result
}

export interface GasParameters {
  verificationGasLimit: BigNumberish
  callGasLimit: BigNumberish
  maxPriorityFeePerGas: BigNumberish
  maxFeePerGas: BigNumberish
}

export interface PackedGasParameters {
  accountGasLimits: BytesLike
  gasFees: BytesLike
}

/**
 * Packs two 128uint gas limit values (validationGasLimit and callGasLimit) into a hex-encoded bytes32 string.
 *
 * @param validationGasLimit - The validation gas limit.
 * @param callGasLimit - The call gas limit.
 * @returns The packed gas limits as a string.
 */
export const packGasParameters = (unpacked: GasParameters): PackedGasParameters => {
  const pack = (hi: BigNumberish, lo: BigNumberish) => ethers.solidityPacked(['uint128', 'uint128'], [hi, lo])
  return {
    accountGasLimits: pack(unpacked.verificationGasLimit, unpacked.callGasLimit),
    gasFees: pack(unpacked.maxPriorityFeePerGas, unpacked.maxFeePerGas),
  }
}

/**
 * Unpacks the account gas limits from a bytes32 hex-encoded string into two uint128 BigInts.
 *
 * @param accountGasLimits - The account gas limits as a bytes32 hex-encoded string.
 * @returns An object containing the validation gas limit and the call gas limit.
 */
export const unpackGasParameters = (packed: PackedGasParameters): GasParameters => {
  const unpack = (word: BytesLike) => {
    if (ethers.dataLength(word) !== 32) {
      throw new Error('Invalid input: packed gas parameter value must be 32-bytes')
    }
    return [BigInt(ethers.dataSlice(word, 0, 16)), ethers.dataSlice(word, 16, 32)] as const
  }
  const [verificationGasLimit, callGasLimit] = unpack(packed.accountGasLimits)
  const [maxPriorityFeePerGas, maxFeePerGas] = unpack(packed.gasFees)

  return { verificationGasLimit, callGasLimit, maxPriorityFeePerGas, maxFeePerGas }
}

/**
 * Unpacks a user operation.
 *
 * @param packedUserOp - The packed user operation.
 * @returns The unpacked user operation.
 */
export const unpackUserOperation = async (packedUserOp: PackedUserOperation): Promise<UserOperation> => {
  return {
    sender: await ethers.resolveAddress(packedUserOp.sender),
    nonce: packedUserOp.nonce,
    ...unpackInitCode(packedUserOp),
    callData: packedUserOp.callData,
    ...unpackGasParameters(packedUserOp),
    preVerificationGas: packedUserOp.preVerificationGas,
    ...unpackPaymasterAndData(packedUserOp),
    signature: packedUserOp.signature,
  }
}

/**
 * Unpacks a user operation's `initCode` field into a factory address and its data.
 *
 * @param _ - The packed user operation.
 * @returns The unpacked `initCode`.
 */
export const unpackInitCode = ({ initCode }: Pick<PackedUserOperation, 'initCode'>): Pick<UserOperation, 'factory' | 'factoryData'> => {
  return ethers.dataLength(initCode) > 0
    ? {
        factory: ethers.getAddress(ethers.dataSlice(initCode, 0, 20)),
        factoryData: ethers.dataSlice(initCode, 20),
      }
    : {}
}

/**
 * Unpacks a user operation's `paymasterAndData` field into a the paymaster options.
 *
 * @param _ - The packed user operation.
 * @returns The unpacked `paymasterAndData`.
 */
export const unpackPaymasterAndData = ({
  paymasterAndData,
}: Pick<PackedUserOperation, 'paymasterAndData'>): Pick<
  UserOperation,
  'paymaster' | 'paymasterVerificationGasLimit' | 'paymasterPostOpGasLimit' | 'paymasterData'
> => {
  return ethers.dataLength(paymasterAndData) > 0
    ? {
        paymaster: ethers.getAddress(ethers.dataSlice(paymasterAndData, 0, 20)),
        paymasterVerificationGasLimit: BigInt(ethers.dataSlice(paymasterAndData, 20, 36)),
        paymasterPostOpGasLimit: BigInt(ethers.dataSlice(paymasterAndData, 36, 52)),
        paymasterData: ethers.dataSlice(paymasterAndData, 52),
      }
    : {}
}
