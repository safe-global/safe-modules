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

type UserOperation = {
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

type UnsignedUserOperation = Omit<UserOperation, 'signature'>

// Dummy signature for gas estimation. We require it so the estimation doesn't revert
// if the signature is absent
const DUMMY_SIGNATURE =
  '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000024477cb92524a5d417b4edc79893c0da534a2b68c3b52deaa57bd4161affa208ed071c2d0a26244371f0cd58f3fbafcb25cc5df74951aeddb5d7d089e95f417ce30000000000000000000000000000000000000000000000000000000000000025a24f744b28d73f066bf3203d145765a7bc735e6328168c8b03e476da3ad0d8fe010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000707b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a225a66395945647573433059726a55756a457673423145493253356b63797a5770616d6c7367734b666a4d41222c226f726967696e223a2268747470733a2f2f736166652e676c6f62616c227d00000000000000000000000000000000'

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
): UnsignedUserOperation {
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
    callGasLimit: ethers.toBeHex(2000000),
    verificationGasLimit: ethers.toBeHex(2000000),
    preVerificationGas: ethers.toBeHex(2000000),
    maxFeePerGas: ethers.toBeHex(10000000000),
    maxPriorityFeePerGas: ethers.toBeHex(10000000000),
    paymasterAndData: '0x',
  }

  console.log(import.meta)
  if (import.meta.env.DEV) {
    console.log('Safe deployment data: ', safeDeploymentData)
    console.log(
      'validateUserOp data for estimation: ',
      getValidateUserOpData({ ...userOp, signature: DUMMY_SIGNATURE }, ethers.ZeroHash, 10000000000),
    )
  }

  return userOp
}

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
function estimateUserOpGasLimit(userOp: UnsignedUserOperation, entryPointAddress = ENTRYPOINT_ADDRESS): Promise<UserOpGasLimitEstimation> {
  ;(userOp as UserOperation).signature = DUMMY_SIGNATURE

  const provider = getEip4337BundlerProvider()
  const estimation = provider.send('eth_estimateUserOperationGas', [userOp, entryPointAddress])

  return estimation
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
 * Packs a UserOperation object into a string using the defaultAbiCoder.
 * @param op The UserOperation object to pack.
 * @returns The packed UserOperation as a string.
 */
function packUserOp(op: UserOperation): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    [
      'address', // sender
      'uint256', // nonce
      'bytes32', // initCode
      'bytes32', // callData
      'uint256', // callGasLimit
      'uint256', // verificationGasLimit
      'uint256', // preVerificationGas
      'uint256', // maxFeePerGas
      'uint256', // maxPriorityFeePerGas
      'bytes32', // paymasterAndData
    ],
    [
      op.sender,
      op.nonce,
      ethers.keccak256(op.initCode),
      ethers.keccak256(op.callData),
      op.callGasLimit,
      op.verificationGasLimit,
      op.preVerificationGas,
      op.maxFeePerGas,
      op.maxPriorityFeePerGas,
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
function getUserOpHash(op: UserOperation, entryPoint: string, chainId: ethers.BigNumberish): string {
  const userOpHash = ethers.keccak256(packUserOp(op))
  const enc = ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'address', 'uint256'], [userOpHash, entryPoint, chainId])
  return ethers.keccak256(enc)
}

export type { UserOperation, UnsignedUserOperation, UserOpGasLimitEstimation }

export { prepareUserOperationWithInitialisation, getEip4337BundlerProvider, estimateUserOpGasLimit, getRequiredPrefund }
