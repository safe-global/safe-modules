import { ethers } from 'ethers'
import {
  SafeInitializer,
  getExecuteUserOpData,
  getInitHash,
  getLaunchpadInitializeThenUserOpData,
  getLaunchpadInitializer,
  getSafeAddress,
  getSafeDeploymentData,
  getValidateUserOpData,
} from './safe'
import {
  APP_CHAIN_ID,
  ENTRYPOINT_ADDRESS,
  SAFE_PROXY_FACTORY_ADDRESS,
  SAFE_SIGNER_LAUNCHPAD_ADDRESS,
  XANDER_BLAZE_NFT_ADDRESS,
} from '../config'
import { encodeSafeMintData } from './erc721'
import {
  PasskeyLocalStorageFormat,
  signWithPasskey
} from "./passkeys";

type PackedUserOperation = {
  sender: string
  nonce: ethers.BigNumberish
  initCode: ethers.BytesLike
  callData: ethers.BytesLike
  accountGasLimits: ethers.BytesLike
  preVerificationGas: ethers.BigNumberish
  gasFees: ethers.BytesLike
  paymasterAndData: ethers.BytesLike
  signature: ethers.BytesLike
}

type UnsignedPackedUserOperation = Omit<PackedUserOperation, 'signature'>

type UserOperation = {
  sender: string
  nonce: ethers.BigNumberish
  factory?: string
  factoryData?: ethers.BytesLike
  callData: ethers.BytesLike
  callGasLimit: ethers.BigNumberish
  verificationGasLimit: ethers.BigNumberish
  preVerificationGas: ethers.BigNumberish
  maxFeePerGas: ethers.BigNumberish
  maxPriorityFeePerGas: ethers.BigNumberish
  paymaster?: string
  paymasterVerificationGasLimit?: ethers.BigNumberish
  paymasterPostOpGasLimit?: ethers.BigNumberish
  paymasterData?: ethers.BytesLike
  signature: ethers.BytesLike
}

// Dummy signature for gas estimation. We require the 12 bytes of validity timestamp data
// so that the estimation doesn't revert. But we also want to use a dummy signature for
// more accurate `verificationGasLimit` (We want to run the P256 signature verification
// code) & `preVerificationGas` (The signature length in bytes should be accurate) estimate.
// The challenge is neither P256 Verification Gas or signature length are stable, so we make
// a calculated guess.
const DUMMY_SIGNATURE = ethers.solidityPacked(
  ['uint48', 'uint48', 'bytes'],
  [
    0,
    0,
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes', 'string', 'uint256', 'uint256'],
      [
        `0x${'a0'.repeat(37)}`, // authenticatorData without any extensions/attestated credential data is always 37 bytes long.
        [
          `"origin":"${location.origin}"`,
          `"padding":"This pads the clientDataJSON so that we can leave room for additional implementation specific fields for a more accurate 'preVerificationGas' estimate."`,
        ].join(','),
        `0x${'ec'.repeat(32)}`,
        `0x${'d5a'.repeat(21)}f`,
      ],
    ),
  ],
)

/**
 * Generates the user operation initialization code.
 * @param proxyFactory - The address of the proxy factory.
 * @param deploymentData - The deployment data.
 * @returns The user operation initialization code.
 */
function getUserOpInitCode(proxyFactory: string, deploymentData: string): string {
  const userOpInitCode = ethers.solidityPacked(['address', 'bytes'], [proxyFactory, deploymentData])
  return userOpInitCode
}

type UserOpCall = {
  to: string
  data: string
  value: string
  operation: 0 | 1
}

/**
 * Prepares a user operation with initialization.
 *
 * @param proxyFactoryAddress - The address of the proxy factory.
 * @param initializer - The safe initializer.
 * @param afterInitializationOpCall - Optional user operation call to be executed after initialization.
 * @param saltNonce - The salt nonce.
 * @returns The unsigned user operation.
 */
function prepareUserOperationWithInitialisation(
  proxyFactoryAddress: string,
  initializer: SafeInitializer,
  afterInitializationOpCall?: UserOpCall,
  saltNonce = ethers.ZeroHash,
): UnsignedPackedUserOperation {
  const initHash = getInitHash(initializer, APP_CHAIN_ID)
  const launchpadInitializer = getLaunchpadInitializer(initHash)
  const predictedSafeAddress = getSafeAddress(launchpadInitializer, SAFE_PROXY_FACTORY_ADDRESS, SAFE_SIGNER_LAUNCHPAD_ADDRESS, saltNonce)
  const safeDeploymentData = getSafeDeploymentData(SAFE_SIGNER_LAUNCHPAD_ADDRESS, launchpadInitializer, saltNonce)
  const userOpCall = afterInitializationOpCall ?? {
    to: XANDER_BLAZE_NFT_ADDRESS,
    data: encodeSafeMintData(predictedSafeAddress),
    value: 0,
    operation: 0,
  }

  const userOp = {
    sender: predictedSafeAddress,
    nonce: ethers.toBeHex(0),
    initCode: getUserOpInitCode(proxyFactoryAddress, safeDeploymentData),
    callData: getLaunchpadInitializeThenUserOpData(
      initializer,
      getExecuteUserOpData(userOpCall.to, userOpCall.value, userOpCall.data, userOpCall.operation),
    ),
    ...packGasParameters({
      callGasLimit: ethers.toBeHex(2000000),
      verificationGasLimit: ethers.toBeHex(2000000),
      maxFeePerGas: ethers.toBeHex(10000000000),
      maxPriorityFeePerGas: ethers.toBeHex(10000000000),
    }),
    preVerificationGas: ethers.toBeHex(2000000),
    paymasterAndData: '0x',
  }

  if (import.meta.env.DEV) {
    console.log('Safe deployment data: ', safeDeploymentData)
    console.log(
      'validateUserOp data for estimation: ',
      getValidateUserOpData({ ...userOp, signature: DUMMY_SIGNATURE }, ethers.ZeroHash, 10000000000),
    )
  }

  return userOp
}

/**
 * Retrieves the EIP-4337 bundler provider.
 * @returns The EIP-4337 bundler provider.
 */
function getEip4337BundlerProvider(): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_WC_4337_BUNDLER_URL, undefined, {
    batchMaxCount: 1,
  })
  return provider
}

type UserOpGasLimitEstimation = {
  preVerificationGas: string
  callGasLimit: string
  verificationGasLimit: string
}

/**
 * Estimates the gas limit for a user operation. A dummy signature will be used.
 * @param userOp - The user operation to estimate gas limit for.
 * @param entryPointAddress - The entry point address. Default value is ENTRYPOINT_ADDRESS.
 * @returns A promise that resolves to the estimated gas limit for the user operation.
 */
function estimateUserOpGasLimit(
  userOp: UnsignedPackedUserOperation,
  entryPointAddress = ENTRYPOINT_ADDRESS,
): Promise<UserOpGasLimitEstimation> {
  const provider = getEip4337BundlerProvider()
  const rpcUserOp = unpackUserOperationForRpc(userOp, DUMMY_SIGNATURE)
  const estimation = provider.send('eth_estimateUserOperationGas', [rpcUserOp, entryPointAddress])

  return estimation
}

/**
 * Unpacks a user operation for use over the bundler RPC.
 * @param userOp The user operation to unpack.
 * @param signature The signature bytes for the user operation.
 * @returns An unpacked `UserOperation` that can be used over bunlder RPC.
 */
function unpackUserOperationForRpc(userOp: UnsignedPackedUserOperation, signature: ethers.BytesLike): UserOperation {
  const initFields =
    ethers.dataLength(userOp.initCode) > 0
      ? {
          factory: ethers.getAddress(ethers.dataSlice(userOp.initCode, 0, 20)),
          factoryData: ethers.dataSlice(userOp.initCode, 20),
        }
      : {}
  const paymasterFields =
    ethers.dataLength(userOp.paymasterAndData) > 0
      ? {
          paymaster: ethers.getAddress(ethers.dataSlice(userOp.initCode, 0, 20)),
          paymasterVerificationGasLimit: ethers.toBeHex(ethers.dataSlice(userOp.paymasterAndData, 20, 36)),
          paymasterPostOpGasLimit: ethers.toBeHex(ethers.dataSlice(userOp.paymasterAndData, 36, 52)),
          paymasterData: ethers.dataSlice(userOp.paymasterAndData, 52),
        }
      : {}
  return {
    sender: ethers.getAddress(userOp.sender),
    nonce: ethers.toBeHex(userOp.nonce),
    ...initFields,
    callData: ethers.hexlify(userOp.callData),
    callGasLimit: ethers.toBeHex(ethers.dataSlice(userOp.accountGasLimits, 16, 32)),
    verificationGasLimit: ethers.toBeHex(ethers.dataSlice(userOp.accountGasLimits, 0, 16)),
    preVerificationGas: ethers.toBeHex(userOp.preVerificationGas),
    maxFeePerGas: ethers.toBeHex(ethers.dataSlice(userOp.gasFees, 16, 32)),
    maxPriorityFeePerGas: ethers.toBeHex(ethers.dataSlice(userOp.gasFees, 0, 16)),
    ...paymasterFields,
    signature: ethers.hexlify(signature),
  }
}

/**
 * Calculates the required prefund amount based on the maximum fee per gas,
 * user operation gas limit estimation, and a multiplier.
 *
 * @param maxFeePerGas - The maximum fee per gas.
 * @param userOpGasLimitEstimation - The estimation of gas limits for user operation.
 * @param multiplier - The multiplier to apply to the gas limits.
 * @returns The required prefund amount as a bigint.
 */
function getRequiredPrefund(maxFeePerGas: bigint, userOpGasLimitEstimation: UserOpGasLimitEstimation, multiplier = 12n): bigint {
  return (
    (BigInt(maxFeePerGas) *
      (BigInt(userOpGasLimitEstimation.preVerificationGas) +
        BigInt(userOpGasLimitEstimation.callGasLimit) +
        BigInt(userOpGasLimitEstimation.verificationGasLimit)) *
      multiplier) /
    10n
  )
}

/**
 * Pasks a user operation gas parameters.
 * @param op The UserOperation gas parameters to pack.
 * @returns The packed UserOperation parameters.
 */
function packGasParameters(
  op: Pick<UserOperation, 'verificationGasLimit' | 'callGasLimit' | 'maxPriorityFeePerGas' | 'maxFeePerGas'>,
): Pick<PackedUserOperation, 'accountGasLimits' | 'gasFees'> {
  return {
    accountGasLimits: ethers.solidityPacked(['uint128', 'uint128'], [op.verificationGasLimit, op.callGasLimit]),
    gasFees: ethers.solidityPacked(['uint128', 'uint128'], [op.maxPriorityFeePerGas, op.maxFeePerGas]),
  }
}

/**
 * Packs a UserOperation object into a string using the defaultAbiCoder.
 * @param op The UserOperation object to pack.
 * @returns The packed UserOperation as a string.
 */
function packUserOpData(op: UnsignedPackedUserOperation): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    [
      'address', // sender
      'uint256', // nonce
      'bytes32', // initCode
      'bytes32', // callData
      'bytes32', // accountGasLimits
      'uint256', // preVerificationGas
      'bytes32', // gasFees
      'bytes32', // paymasterAndData
    ],
    [
      op.sender,
      op.nonce,
      ethers.keccak256(op.initCode),
      ethers.keccak256(op.callData),
      op.accountGasLimits,
      op.preVerificationGas,
      op.gasFees,
      ethers.keccak256(op.paymasterAndData),
    ],
  )
}

/**
 * Calculates the hash of a user operation.
 * @param op The user operation.
 * @param entryPoint The entry point.
 * @param chainId The chain ID.
 * @returns The hash of the user operation.
 */
function getUserOpHash(
  op: UnsignedPackedUserOperation,
  entryPoint: string = ENTRYPOINT_ADDRESS,
  chainId: ethers.BigNumberish = APP_CHAIN_ID,
): string {
  const userOpHash = ethers.keccak256(packUserOpData(op))
  const enc = ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'address', 'uint256'], [userOpHash, entryPoint, chainId])
  return ethers.keccak256(enc)
}


/**
 * Signs and sends a user operation to the specified entry point on the blockchain.
 * @param userOp The unsigned user operation to sign and send.
 * @param passkey The passkey used for signing the user operation.
 * @param entryPoint The entry point address on the blockchain. Defaults to ENTRYPOINT_ADDRESS if not provided.
 * @param chainId The chain ID of the blockchain. Defaults to APP_CHAIN_ID if not provided.
 * @returns User Operation hash promise.
 * @throws An error if signing the user operation fails.
 */
async function signAndSendUserOp(
  userOp: UnsignedPackedUserOperation,
  passkey: PasskeyLocalStorageFormat,
  entryPoint: string = ENTRYPOINT_ADDRESS,
  chainId: ethers.BigNumberish = APP_CHAIN_ID,
): Promise<string> {
  const userOpHash = getUserOpHash(userOp, entryPoint, chainId)

  const safeInitOp = {
    userOpHash,
    validAfter: 0,
    validUntil: 0,
    entryPoint: ENTRYPOINT_ADDRESS,
  }

  const safeInitOpHash = ethers.TypedDataEncoder.hash(
    { verifyingContract: SAFE_SIGNER_LAUNCHPAD_ADDRESS, chainId },
    {
      SafeInitOp: [
        { type: 'bytes32', name: 'userOpHash' },
        { type: 'uint48', name: 'validAfter' },
        { type: 'uint48', name: 'validUntil' },
        { type: 'address', name: 'entryPoint' },
      ],
    },
    safeInitOp,
  )

  const passkeySignature = await signWithPasskey(passkey.rawId, safeInitOpHash)

  const signature = ethers.solidityPacked(
    ['uint48', 'uint48', 'bytes'],
    [
      safeInitOp.validAfter,
      safeInitOp.validUntil,
      passkeySignature
    ],
  )

  const rpcUserOp = unpackUserOperationForRpc(userOp, signature)
  return await getEip4337BundlerProvider().send('eth_sendUserOperation', [rpcUserOp, entryPoint])
}

export type { PackedUserOperation, UnsignedPackedUserOperation, UserOperation, UserOpGasLimitEstimation }

export {
  prepareUserOperationWithInitialisation,
  packGasParameters,
  getEip4337BundlerProvider,
  estimateUserOpGasLimit,
  getRequiredPrefund,
  getUserOpHash,
  signAndSendUserOp,
}
