import { ethers } from 'ethers'
import { abi as EntryPointAbi } from '@account-abstraction/contracts/artifacts/EntryPoint.json'
import { IEntryPoint } from '@safe-global/safe-4337/dist/typechain-types'
import {
  SafeInitializer,
  getExecuteUserOpData,
  getInitHash,
  getLaunchpadInitializeThenUserOpData,
  getLaunchpadInitializer,
  getSafeAddress,
  getSafeDeploymentData,
  getValidateUserOpData,
  getSignerAddressFromPubkeyCoords,
} from './safe'
import {
  APP_CHAIN_ID,
  ENTRYPOINT_ADDRESS,
  SAFE_4337_MODULE_ADDRESS,
  SAFE_PROXY_FACTORY_ADDRESS,
  SAFE_SIGNER_LAUNCHPAD_ADDRESS,
  XANDER_BLAZE_NFT_ADDRESS,
} from '../config'
import { encodeSafeMintData } from './erc721'
import { PasskeyLocalStorageFormat, signWithPasskey } from './passkeys'
import { calculateSafeOperationHash, unpackGasParameters, SafeUserOperation } from '@safe-global/safe-4337/dist/src/utils/userOp.js'
import {
  PackedUserOperation as PackedUserOperationOgType,
  UserOperation as UserOperationOgType,
} from '@safe-global/safe-4337/dist/src/utils/userOp'
import { buildSignatureBytes } from '@safe-global/safe-4337/dist/src/utils/execution'

type UserOperation = UserOperationOgType & { sender: string }
type PackedUserOperation = PackedUserOperationOgType & { sender: string }
type UnsignedPackedUserOperation = Omit<PackedUserOperation, 'signature'>

/**
 * Dummy client data JSON fields. This can be used for gas estimations, as it pads the fields enough
 * to account for variations in WebAuthn implementations.
 */
export const DUMMY_CLIENT_DATA_FIELDS = [
  `"origin":"http://safe.global"`,
  `"padding":"This pads the clientDataJSON so that we can leave room for additional implementation specific fields for a more accurate 'preVerificationGas' estimate."`,
].join(',')

/**
 * Dummy authenticator data. This can be used for gas estimations, as it ensures that the correct
 * authenticator flags are set.
 */
export const DUMMY_AUTHENTICATOR_DATA = new Uint8Array(37)
// Authenticator data is the concatenation of:
// - 32 byte SHA-256 hash of the relying party ID
// - 1 byte for the user verification flag
// - 4 bytes for the signature count
// We fill it all with `0xfe` and set the appropriate user verification flag.
DUMMY_AUTHENTICATOR_DATA.fill(0xfe)
DUMMY_AUTHENTICATOR_DATA[32] = 0x04

/**
 * Encodes the given WebAuthn signature into a string. This computes the ABI-encoded signature parameters:
 * ```solidity
 * abi.encode(authenticatorData, clientDataFields, r, s);
 * ```
 *
 * @param authenticatorData - The authenticator data as a Uint8Array.
 * @param clientDataFields - The client data fields as a string.
 * @param r - The value of r as a bigint.
 * @param s - The value of s as a bigint.
 * @returns The encoded string.
 */
export function getSignatureBytes({
  authenticatorData,
  clientDataFields,
  r,
  s,
}: {
  authenticatorData: Uint8Array
  clientDataFields: string
  r: bigint
  s: bigint
}): string {
  // Helper functions
  // Convert a number to a 64-byte hex string with padded upto Hex string with 32 bytes
  const encodeUint256 = (x: bigint | number) => x.toString(16).padStart(64, '0')
  // Calculate the byte size of the dynamic data along with the length parameter alligned to 32 bytes
  const byteSize = (data: Uint8Array) => 32 * (Math.ceil(data.length / 32) + 1) // +1 is for the length parameter
  // Encode dynamic data padded with zeros if necessary in 32 bytes chunks
  const encodeBytes = (data: Uint8Array) => `${encodeUint256(data.length)}${ethers.hexlify(data).slice(2)}`.padEnd(byteSize(data) * 2, '0')

  // authenticatorData starts after the first four words.
  const authenticatorDataOffset = 32 * 4
  // clientDataFields starts immediately after the authenticator data.
  const clientDataFieldsOffset = authenticatorDataOffset + byteSize(authenticatorData)

  return (
    '0x' +
    encodeUint256(authenticatorDataOffset) +
    encodeUint256(clientDataFieldsOffset) +
    encodeUint256(r) +
    encodeUint256(s) +
    encodeBytes(authenticatorData) +
    encodeBytes(new TextEncoder().encode(clientDataFields))
  )
}

// Dummy signature for gas estimation. We require the 12 bytes of validity timestamp data
// so that the estimation doesn't revert. But we also want to use a dummy signature for
// more accurate `verificationGasLimit` (We want to run the P256 signature verification
// code) & `preVerificationGas` (The signature length in bytes should be accurate) estimate.
// The challenge is neither P256 Verification Gas nor signature length are stable, so we make
// a calculated guess.
const DUMMY_SIGNATURE_LAUNCHPAD = ethers.solidityPacked(
  ['uint48', 'uint48', 'bytes'],
  [
    0,
    0,
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes', 'string', 'uint256', 'uint256'],
      [
        DUMMY_AUTHENTICATOR_DATA, // authenticatorData without any extensions/attestated credential data is always 37 bytes long.
        DUMMY_CLIENT_DATA_FIELDS,
        `0x${'ec'.repeat(32)}`,
        `0x${'d5a'.repeat(21)}f`,
      ],
    ),
  ],
)

/**
 * Generates a dummy signature for a user operation.
 *
 * @param signer - The Ethereum address of the signer.
 * @returns The dummy signature for a user operation.
 */
function dummySignatureUserOp(signer: string) {
  return ethers.solidityPacked(
    ['uint48', 'uint48', 'bytes'],
    [
      0,
      0,
      buildSignatureBytes([
        {
          signer,
          data: getSignatureBytes({
            authenticatorData: DUMMY_AUTHENTICATOR_DATA,
            clientDataFields: DUMMY_CLIENT_DATA_FIELDS,
            r: BigInt(`0x${'ec'.repeat(32)}`),
            s: BigInt(`0x${'d5a'.repeat(21)}f`),
          }),
          dynamic: true,
        },
      ]),
    ],
  )
}

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
  value: ethers.BigNumberish
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
      getValidateUserOpData({ ...userOp, signature: DUMMY_SIGNATURE_LAUNCHPAD }, ethers.ZeroHash, 10000000000),
    )
  }

  return userOp
}

function getUnsignedUserOperation(call: UserOpCall, safeAddress: string, nonce: ethers.BigNumberish): UnsignedPackedUserOperation {
  return {
    sender: safeAddress,
    nonce,
    initCode: '0x',
    callData: getExecuteUserOpData(call.to, call.value, call.data, call.operation),
    accountGasLimits: ethers.solidityPacked(['uint128', 'uint128'], [2000000, 2000000]),
    preVerificationGas: 2000000,
    gasFees: ethers.solidityPacked(['uint128', 'uint128'], [10000000000, 10000000000]),
    paymasterAndData: '0x',
  }
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

/**
 * Returns an instance of the EntryPoint contract.
 * @param provider - The ethers.js JsonRpcProvider to use for interacting with the Ethereum network.
 * @param address - The Ethereum address of the deployed EntryPoint contract.
 * @returns An instance of the EntryPoint contract.
 */
function getEntryPointContract(provider: ethers.JsonRpcApiProvider, address: string): IEntryPoint {
  return new ethers.Contract(address, EntryPointAbi, provider) as unknown as IEntryPoint
}

/**
 * Retrieves the nonce from the entry point.
 *
 * @param provider - The ethers.js JsonRpcProvider to use for interacting with the Ethereum network.
 * @param safeAddress - The Ethereum address of the safe for which to retrieve the nonce.
 * @param entryPoint - The Ethereum address of the entry point. Defaults to {@link ENTRYPOINT_ADDRESS} if not provided.
 * @returns A promise that resolves to the nonce for the provided safe address.
 */
async function getNonceFromEntryPoint(
  provider: ethers.JsonRpcApiProvider,
  safeAddress: string,
  entryPoint = ENTRYPOINT_ADDRESS,
): Promise<bigint> {
  const entrypoint = getEntryPointContract(provider, entryPoint)
  const nonce = await entrypoint.getNonce(safeAddress, 0)

  return nonce
}

async function getAccountEntryPointBalance(
  provider: ethers.JsonRpcApiProvider,
  safeAddress: string,
  entryPoint = ENTRYPOINT_ADDRESS,
): Promise<bigint> {
  const entrypoint = getEntryPointContract(provider, entryPoint)
  const balance = await entrypoint.balanceOf(safeAddress)

  return balance
}

type UserOpGasLimitEstimation = {
  preVerificationGas: string
  callGasLimit: string
  verificationGasLimit: string
  paymasterVerificationGasLimit: string
  paymasterPostOpGasLimit: string
}

/**
 * Estimates the gas limit for a user operation. A dummy signature will be used.
 * @param userOp - The user operation to estimate gas limit for.
 * @param signerAddress - The signer address.
 * @param entryPointAddress - The entry point address. Default value is ENTRYPOINT_ADDRESS.
 * @returns A promise that resolves to the estimated gas limit for the user operation.
 */
async function estimateUserOpGasLimit(
  userOp: UnsignedPackedUserOperation,
  signerAddress?: string,
  entryPointAddress = ENTRYPOINT_ADDRESS,
): Promise<UserOpGasLimitEstimation> {
  const provider = getEip4337BundlerProvider()

  const placeholderSignature =
    (userOp.initCode.length > 0 && userOp.initCode !== '0x') || !signerAddress
      ? DUMMY_SIGNATURE_LAUNCHPAD
      : dummySignatureUserOp(signerAddress)

  const rpcUserOp = unpackUserOperationForRpc(userOp, placeholderSignature)
  const estimation = await provider.send('eth_estimateUserOperationGas', [rpcUserOp, entryPointAddress])

  return estimation
}

/**
 * Unpacks a user operation for use over the bundler RPC.
 * @param userOp The user operation to unpack.
 * @param signature The signature bytes for the user operation.
 * @returns An unpacked `UserOperation` that can be used over bundler RPC.
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
 * Calculates the missing funds for an account.
 * Missing funds is the amount of funds required by the entry point to execute the user operation.
 *
 * @param maxFeePerGas - The maximum fee per gas for the user operation.
 * @param userOpGasLimitEstimation - The gas limit estimation for the user operation.
 * @param currentEntryPointDeposit - The current deposit at the entry point. Defaults to 0n if not provided.
 * @param multiplier - The multiplier used in the calculation. Defaults to 12n if not provided.
 * @returns The missing funds for the account.
 */
function getMissingAccountFunds(
  maxFeePerGas: bigint,
  userOpGasLimitEstimation: UserOpGasLimitEstimation,
  currentEntryPointDeposit = 0n,
  multiplier = 12n,
): bigint {
  return (
    (BigInt(maxFeePerGas) *
      (BigInt(userOpGasLimitEstimation.preVerificationGas) +
        BigInt(userOpGasLimitEstimation.callGasLimit) +
        BigInt(userOpGasLimitEstimation.verificationGasLimit) +
        BigInt(userOpGasLimitEstimation.paymasterVerificationGasLimit) +
        BigInt(userOpGasLimitEstimation.paymasterPostOpGasLimit)) *
      multiplier) /
      10n -
    currentEntryPointDeposit
  )
}

/**
 * Packs a user operation gas parameters.
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
 * Off-chain replication of the function to calculate user operation hash from the entrypoint.
 * @param op The user operation.
 * @param entryPoint The entry point.
 * @param chainId The chain ID.
 * @returns The hash of the user operation.
 */
function getEntryPointUserOpHash(
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
async function signAndSendDeploymentUserOp(
  userOp: UnsignedPackedUserOperation,
  passkey: PasskeyLocalStorageFormat,
  entryPoint: string = ENTRYPOINT_ADDRESS,
  chainId: ethers.BigNumberish = APP_CHAIN_ID,
): Promise<string> {
  const userOpHash = getEntryPointUserOpHash(userOp, entryPoint, chainId)

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

  const signature = ethers.solidityPacked(['uint48', 'uint48', 'bytes'], [safeInitOp.validAfter, safeInitOp.validUntil, passkeySignature])

  const rpcUserOp = unpackUserOperationForRpc(userOp, signature)
  return await getEip4337BundlerProvider().send('eth_sendUserOperation', [rpcUserOp, entryPoint])
}

/**
 * Signs and sends a user operation to the specified entry point on the blockchain.
 * @param userOp The unsigned user operation to sign and send.
 * @param passkey The passkey used for signing the user operation.
 * @param provider The ethers.js JsonRpcProvider to use for interacting with the Ethereum network.
 * @param entryPoint The entry point address on the blockchain. Defaults to ENTRYPOINT_ADDRESS if not provided.
 * @param chainId The chain ID of the blockchain. Defaults to APP_CHAIN_ID if not provided.
 * @returns User Operation hash promise.
 * @throws An error if signing the user operation fails.
 */
async function signAndSendUserOp(
  provider: ethers.JsonRpcApiProvider,
  userOp: UnsignedPackedUserOperation,
  passkey: PasskeyLocalStorageFormat,
  entryPoint: string = ENTRYPOINT_ADDRESS,
  chainId: ethers.BigNumberish = APP_CHAIN_ID,
): Promise<string> {
  const safeOp: SafeUserOperation = {
    callData: userOp.callData,
    nonce: userOp.nonce,
    initCode: userOp.initCode,
    paymasterAndData: userOp.paymasterAndData,
    preVerificationGas: userOp.preVerificationGas,
    entryPoint,
    validAfter: 0,
    validUntil: 0,
    safe: userOp.sender,
    ...unpackGasParameters(userOp),
  }

  const safeOpHash = calculateSafeOperationHash(SAFE_4337_MODULE_ADDRESS, safeOp, chainId)
  const passkeySignature = await signWithPasskey(passkey.rawId, safeOpHash)
  const signatureBytes = buildSignatureBytes([
    {
      signer: await getSignerAddressFromPubkeyCoords(provider, passkey.pubkeyCoordinates.x, passkey.pubkeyCoordinates.y),
      data: passkeySignature,
      dynamic: true,
    },
  ])

  const signature = ethers.solidityPacked(['uint48', 'uint48', 'bytes'], [0, 0, signatureBytes])
  if (import.meta.env.DEV) {
    console.log('validateUserOp data for estimation: ', getValidateUserOpData({ ...userOp, signature }, ethers.ZeroHash, 10000000000))
  }

  const rpcUserOp = unpackUserOperationForRpc(userOp, signature)
  return await getEip4337BundlerProvider().send('eth_sendUserOperation', [rpcUserOp, entryPoint])
}

export type { PackedUserOperation, UnsignedPackedUserOperation, UserOperation, UserOpGasLimitEstimation }

export {
  prepareUserOperationWithInitialisation,
  packGasParameters,
  getEip4337BundlerProvider,
  getNonceFromEntryPoint,
  getUnsignedUserOperation,
  estimateUserOpGasLimit,
  getMissingAccountFunds,
  getAccountEntryPointBalance,
  signAndSendDeploymentUserOp,
  signAndSendUserOp,
}
