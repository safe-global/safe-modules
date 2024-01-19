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
import { PasskeyLocalStorageFormat } from './passkeys'
import { hexStringToUint8Array } from '../utils'

type UserOperation = {
  sender: string
  nonce: string
  initCode: string
  callData: string
  callGasLimit: ethers.BigNumberish
  verificationGasLimit: ethers.BigNumberish
  preVerificationGas: ethers.BigNumberish
  maxFeePerGas: ethers.BigNumberish
  maxPriorityFeePerGas: ethers.BigNumberish
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
function getUserOpHash(
  op: UnsignedUserOperation,
  entryPoint: string = ENTRYPOINT_ADDRESS,
  chainId: ethers.BigNumberish = APP_CHAIN_ID,
): string {
  const userOpHash = ethers.keccak256(packUserOp(op))
  const enc = ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'address', 'uint256'], [userOpHash, entryPoint, chainId])
  return ethers.keccak256(enc)
}

/**
 * Encode bytes using the Base64 URL encoding.
 *
 * See <https://www.rfc-editor.org/rfc/rfc4648#section-5>
 *
 * @param data data to encode to `base64url`
 * @returns the `base64url` encoded data as a string.
 */
function base64UrlEncode(data: ethers.BytesLike | ArrayBufferLike): string {
  const bytes = ethers.isBytesLike(data) ? data : new Uint8Array(data)
  return ethers.encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=*$/, '')
}

/**
 * Extracts the offset of the challenge within the client data JSON.
 * @param response - The AuthenticatorAssertionResponse object.
 * @param challenge - The challenge string.
 * @returns The offset of the challenge within the client data JSON.
 * @throws Error if the challenge is not found in the client data JSON.
 */
function extractChallengeOffset(response: AuthenticatorAssertionResponse, challenge: string): number {
  const clientDataJSON = new TextDecoder('utf-8').decode(response.clientDataJSON)

  const encodedChallenge = base64UrlEncode(challenge)
  const offset = clientDataJSON.indexOf(encodedChallenge)
  if (offset < 0) {
    throw new Error('challenge not found in client data JSON')
  }

  return offset
}

/**
 * Extracts the signature into R and S values from the authenticator response.
 *
 * See:
 * - <https://datatracker.ietf.org/doc/html/rfc3279#section-2.2.3>
 * - <https://en.wikipedia.org/wiki/X.690#BER_encoding>
 */
function extractSignature(response: AuthenticatorAssertionResponse): [bigint, bigint] {
  const check = (x: boolean) => {
    if (!x) {
      throw new Error('invalid signature encoding')
    }
  }

  // Decode the DER signature. Note that we assume that all lengths fit into 8-bit integers,
  // which is true for the kinds of signatures we are decoding but generally false. I.e. this
  // code should not be used in any serious application.
  const view = new DataView(response.signature)

  // check that the sequence header is valid
  check(view.getUint8(0) === 0x30)
  check(view.getUint8(1) === view.byteLength - 2)

  // read r and s
  const readInt = (offset: number) => {
    check(view.getUint8(offset) === 0x02)
    const len = view.getUint8(offset + 1)
    const start = offset + 2
    const end = start + len
    const n = BigInt(ethers.hexlify(new Uint8Array(view.buffer.slice(start, end))))
    check(n < ethers.MaxUint256)
    return [n, end] as const
  }
  const [r, sOffset] = readInt(2)
  const [s] = readInt(sOffset)

  return [r, s]
}

/**
 * Signs and sends a user operation to the specified entry point on the blockchain.
 * @param userOp The unsigned user operation to sign and send.
 * @param passkey The passkey used for signing the user operation.
 * @param entryPoint The entry point address on the blockchain. Defaults to ENTRYPOINT_ADDRESS if not provided.
 * @param chainId The chain ID of the blockchain. Defaults to APP_CHAIN_ID if not provided.
 * @returns A Promise that resolves to the result of sending the user operation.
 * @throws An error if signing the user operation fails.
 */
async function signAndSendUserOp(
  userOp: UnsignedUserOperation,
  passkey: PasskeyLocalStorageFormat,
  entryPoint: string = ENTRYPOINT_ADDRESS,
  chainId: ethers.BigNumberish = APP_CHAIN_ID,
): Promise<unknown> {
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

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: ethers.getBytes(safeInitOpHash),
      allowCredentials: [{ type: 'public-key', id: hexStringToUint8Array(passkey.rawId) }],
    },
  })

  if (!assertion) {
    throw new Error('Failed to sign user operation')
  }

  const signature = ethers.solidityPacked(
    ['uint48', 'uint48', 'bytes'],
    [
      safeInitOp.validAfter,
      safeInitOp.validUntil,
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes', 'bytes', 'uint256', 'uint256[2]'],
        [
          new Uint8Array(assertion.response.authenticatorData),
          new Uint8Array(assertion.response.clientDataJSON),
          extractChallengeOffset(assertion.response, safeInitOpHash),
          extractSignature(assertion.response),
        ],
      ),
    ],
  )

  const userOpWithSignature = { ...userOp, signature }

  return await getEip4337BundlerProvider().send('eth_sendUserOperation', [userOpWithSignature, entryPoint])
}

export type { UserOperation, UnsignedUserOperation, UserOpGasLimitEstimation }

export {
  prepareUserOperationWithInitialisation,
  getEip4337BundlerProvider,
  estimateUserOpGasLimit,
  getRequiredPrefund,
  getUserOpHash,
  signAndSendUserOp,
}
