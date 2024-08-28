import { ethers } from 'ethers'
import { abi as EntryPointAbi } from '@account-abstraction/contracts/artifacts/EntryPoint.json'
import { IEntryPoint } from '@safe-global/safe-4337/dist/typechain-types'
import { getSignatureBytes, DUMMY_AUTHENTICATOR_DATA, DUMMY_CLIENT_DATA_FIELDS } from '@safe-global/safe-passkey/dist/src/utils/webauthn'
import { getExecuteUserOpData, getValidateUserOpData } from './safe'
import { APP_CHAIN_ID, ENTRYPOINT_ADDRESS, SAFE_4337_MODULE_ADDRESS, SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS } from '../config'
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
 * Generates a dummy signature for a user operation.
 *
 * @returns The dummy signature for a user operation.
 */
function dummySignatureUserOp() {
  return ethers.solidityPacked(
    ['uint48', 'uint48', 'bytes'],
    [
      0,
      0,
      buildSignatureBytes([
        {
          signer: SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS,
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

function getUnsignedUserOperation(
  call: UserOpCall,
  safeAddress: string,
  nonce: ethers.BigNumberish,
  initCode = '0x',
): UnsignedPackedUserOperation {
  return {
    sender: safeAddress,
    nonce,
    initCode,
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
  entryPointAddress = ENTRYPOINT_ADDRESS,
): Promise<UserOpGasLimitEstimation> {
  const provider = getEip4337BundlerProvider()

  const placeholderSignature = dummySignatureUserOp()

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
      signer: SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS,
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
  packGasParameters,
  getEip4337BundlerProvider,
  getNonceFromEntryPoint,
  getUserOpInitCode,
  getUnsignedUserOperation,
  estimateUserOpGasLimit,
  getMissingAccountFunds,
  getAccountEntryPointBalance,
  signAndSendUserOp,
}
