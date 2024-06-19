import { ethers } from 'ethers'
import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider'
import { buildPackedUserOperationFromSafeUserOperation, PLACEHOLDER_SIGNATURE, SafeUserOperation } from '../../src/utils/userOp'
import { EntryPointSimulations } from '../../typechain-types'

export interface GasOverheads {
  /**
   * fixed overhead for entire handleOp bundle.
   */
  fixed: number

  /**
   * per userOp overhead, added on top of the above fixed per-bundle.
   */
  perUserOp: number

  /**
   * overhead for userOp word (32 bytes) block
   */
  perUserOpWord: number

  // perCallDataWord: number

  /**
   * zero byte cost, for calldata gas cost calculations
   */
  zeroByte: number

  /**
   * non-zero byte cost, for calldata gas cost calculations
   */
  nonZeroByte: number

  /**
   * expected bundle size, to split per-bundle overhead between all ops.
   */
  bundleSize: number

  /**
   * expected length of the userOp signature.
   */
  sigSize: number
}


/**
 * Calculates the gas cost for pre-verification of a Safe user operation.
 * preVerificationGas (by definition) is the cost overhead that can't be calculated on-chain.
 * it is based on parameters that are defined by the Ethereum protocol for external transactions.
 * @param userOp - The Safe user operation.
 * @returns The gas cost as a bigint.
 */
export const calcPreVerificationGas = (userOp: SafeUserOperation): bigint => {
  const gasOverheads: GasOverheads = {
    fixed: 21000,
    perUserOp: 18300,
    perUserOpWord: 4,
    zeroByte: 4,
    nonZeroByte: 16,
    bundleSize: 1,
    sigSize: 65,
  }
  const op: SafeUserOperation = {
    // dummy values, in case the UserOp is incomplete.
    ...userOp,
    preVerificationGas: 21000, // dummy value, just for calldata cost
  }

  const packed = buildPackedUserOperationFromSafeUserOperation({ safeOp: op, signature: PLACEHOLDER_SIGNATURE })
  const encoded = ethers.toBeArray(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'bytes', 'bytes', 'bytes32', 'uint256', 'bytes32', 'bytes', 'bytes'],
      [
        packed.sender,
        packed.nonce,
        packed.initCode,
        packed.callData,
        packed.accountGasLimits,
        packed.preVerificationGas,
        packed.gasFees,
        packed.paymasterAndData,
        packed.signature,
      ],
    ),
  )
  const lengthInWord = (encoded.length + 31) / 32
  const callDataCost = encoded.map((x) => (x === 0 ? gasOverheads.zeroByte : gasOverheads.nonZeroByte)).reduce((sum, x) => sum + x)
  const ret = Math.round(
    callDataCost + gasOverheads.fixed / gasOverheads.bundleSize + gasOverheads.perUserOp + gasOverheads.perUserOpWord * lengthInWord,
  )
  return BigInt(ret)
}

export interface EstimateUserOpGasResult {
  /**
   * the preVerification gas used by this UserOperation.
   */
  preVerificationGas: bigint
  /**
   * gas used for validation of this UserOperation, including account creation
   */
  verificationGasLimit: bigint
  /**
   * estimated cost of calling the account with the given callData
   */
  callGasLimit: bigint
}

export type ExecutionResultStructOutput = [
  preOpGas: ethers.BigNumberish,
  paid: ethers.BigNumberish,
  accountValidationData: ethers.BigNumberish,
  paymasterValidationData: ethers.BigNumberish,
  targetSuccess: boolean,
  targetResult: string,
] & {
  preOpGas: ethers.BigNumberish
  paid: ethers.BigNumberish
  accountValidationData: ethers.BigNumberish
  paymasterValidationData: ethers.BigNumberish
  targetSuccess: boolean
  targetResult: string
}

export const calcVerificationGasAndCallGasLimit = (userOperation: SafeUserOperation, executionResult: ExecutionResultStructOutput) => {
  const verificationGasLimit = BigInt(executionResult.preOpGas) - BigInt(userOperation.preVerificationGas)

  const gasPrice = BigInt(userOperation.maxFeePerGas)

  const callGasLimit = BigInt(executionResult.paid) / gasPrice - BigInt(executionResult.preOpGas)

  return { verificationGasLimit, callGasLimit }
}

export const estimateUserOperationGas = async (
  provider: HardhatEthersProvider,
  entryPointSimulations: EntryPointSimulations,
  safeOp: SafeUserOperation,
  entryPointAddress: string,
  ): Promise<EstimateUserOpGasResult> => {
  const preVerificationGas = calcPreVerificationGas(safeOp)
  const opWithPreVerificationGas = { ...safeOp, preVerificationGas }
    
  const packedUserOp = buildPackedUserOperationFromSafeUserOperation({ safeOp: opWithPreVerificationGas, signature: PLACEHOLDER_SIGNATURE })
  const encodedSimulateHandleOp = entryPointSimulations.interface.encodeFunctionData('simulateHandleOp', [
    packedUserOp,
    ethers.ZeroAddress,
    '0x',
  ])

  const simulationData = await provider.send('eth_call', [
    {
      to: entryPointAddress,
      data: encodedSimulateHandleOp,
    },
    'latest',
    {
      [entryPointAddress]: {
        code: await entryPointSimulations.getDeployedCode(),
      },
    },
  ])
  const executionResultStruct = entryPointSimulations.interface.decodeFunctionResult(
    'simulateHandleOp',
    simulationData,
  )[0] as unknown as ExecutionResultStructOutput
  const { verificationGasLimit, callGasLimit } = calcVerificationGasAndCallGasLimit(opWithPreVerificationGas, executionResultStruct)

  return {
    preVerificationGas,
    callGasLimit,
    verificationGasLimit,
  }
}
