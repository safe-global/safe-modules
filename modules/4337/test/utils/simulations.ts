import { ethers } from 'ethers'
import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider'
import { buildPackedUserOperationFromSafeUserOperation, PLACEHOLDER_SIGNATURE, SafeUserOperation } from '../../src/utils/userOp'
import { EntryPointSimulations } from '../../typechain-types'

export interface GasOverheads {
  // fixed overhead for entire handleOp bundle.
  fixed: number

  // The per userOp overhead, added on top of the above fixed per-bundle.
  perUserOp: number

  // The overhead for userOp word (32 bytes) block.
  perUserOpWord: number

  // perCallDataWord: number

  // The gas cost for zero bytes, used in calldata gas cost calculations.
  zeroByte: number

  // The gas cost for non-zero bytes, used in calldata gas cost calculations.
  nonZeroByte: number

  // The expected bundle size, used to split per-bundle overhead between all ops.
  bundleSize: number

  // The expected length of the userOp signature.
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
  // the preVerification gas used by this UserOperation.
  preVerificationGas: bigint
  // gas used for validation of this UserOperation, including account creation
  verificationGasLimit: bigint
  // estimated cost of calling the account with the given callData
  callGasLimit: bigint
  // total gas paid for this UserOperation, useful for tests that verify account balance changes. Important: this is only an estimate.
  totalGasPaid: bigint
  // max fee per gas used for the estimate
  maxFeePerGas: bigint
  // max priority fee per gas used for the estimate
  maxPriorityFeePerGas: bigint
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

/**
 * Calculates the verification gas limit and call gas limit based on the user operation and execution result.
 * @param userOperation - The user operation object.
 * @param executionResult - The execution result object.
 * @returns An object containing the verification gas limit and call gas limit.
 */
export const calcVerificationGasAndCallGasLimit = (userOperation: SafeUserOperation, executionResult: ExecutionResultStructOutput) => {
  const verificationGasLimit = BigInt(executionResult.preOpGas) - BigInt(userOperation.preVerificationGas)

  const gasPrice = BigInt(userOperation.maxFeePerGas)

  const callGasLimit = BigInt(executionResult.paid) / gasPrice - BigInt(executionResult.preOpGas)

  return { verificationGasLimit, callGasLimit }
}

/**
 * Estimates gas for a user operation on a Safe account.
 *
 * This function performs a simulation of the user operation to estimate User Operation gas parameters
 * required for executing the operation on the blockchain. It uses state overrides to replace the EntryPoint code
 * with the EntryPointSimulations contract, which allows for gas estimation without actually executing the operation.
 *
 * TODO: This function doesn't support the case where multiple user operations are bundled together. To implement this,
 * we can use Pimlico's EntryPointSimulations contract to simulate the execution of multiple user operations:
 * https://github.com/pimlicolabs/alto/blob/5f0fb585870cfca3d081e962989c682aa3c02ff4/contracts/src/PimlicoEntryPointSimulations/PimlicoEntryPointSimulations.sol
 *
 * @param provider - The Hardhat Ethers provider used for blockchain interactions.
 * @param entryPointSimulations - An instance of EntryPointSimulations contract for simulating operations.
 * @param safeOp - The Safe user operation to estimate gas for.
 * @param entryPointAddress - The address of the EntryPoint contract.
 *
 * @returns A promise that resolves to an EstimateUserOpGasResult object containing:
 *   - preVerificationGas: The gas required for pre-verification steps.
 *   - callGasLimit: The gas limit for the main execution call.
 *   - verificationGasLimit: The gas limit for the verification step.
 *   - totalGasPaid: The total amount of gas paid for the operation.
 *   - maxFeePerGas: The maximum fee per gas unit.
 *   - maxPriorityFeePerGas: The maximum priority fee per gas unit.
 *
 * @throws Error if fee data is missing from the provider.
 */
export const estimateUserOperationGas = async (
  provider: HardhatEthersProvider,
  entryPointSimulations: EntryPointSimulations,
  safeOp: SafeUserOperation,
  entryPointAddress: string,
): Promise<EstimateUserOpGasResult> => {
  const feeData = await provider.getFeeData()
  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    throw new Error('Fee data is missing')
  }
  const opWithGasData = { ...safeOp, maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas }
  const preVerificationGas = calcPreVerificationGas(safeOp)
  opWithGasData.preVerificationGas = preVerificationGas

  const packedUserOp = buildPackedUserOperationFromSafeUserOperation({ safeOp: opWithGasData, signature: PLACEHOLDER_SIGNATURE })
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
  const { verificationGasLimit, callGasLimit } = calcVerificationGasAndCallGasLimit(opWithGasData, executionResultStruct)

  return {
    preVerificationGas,
    callGasLimit,
    verificationGasLimit,
    totalGasPaid: BigInt(executionResultStruct.paid),
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  }
}
