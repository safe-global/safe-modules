import { useState, useEffect } from 'react'
import { UnsignedPackedUserOperation, UserOpGasLimitEstimation, estimateUserOpGasLimit } from '../logic/userOp'
import { RequestStatus } from '../utils'

/**
 * Custom hook for estimating the gas limit of a user operation.
 * @param userOp The unsigned user operation.
 * @returns An object containing the user operation gas limit estimation and the request status.
 */
function useUserOpGasLimitEstimation(userOp: UnsignedPackedUserOperation): {
  userOpGasLimitEstimation: UserOpGasLimitEstimation | undefined
  status: RequestStatus
}
function useUserOpGasLimitEstimation(
  userOp: UnsignedPackedUserOperation,
  signerAddress: string,
): {
  userOpGasLimitEstimation: UserOpGasLimitEstimation | undefined
  status: RequestStatus
}
function useUserOpGasLimitEstimation(userOp: UnsignedPackedUserOperation, signerAddress?: string) {
  const [userOpGasLimitEstimation, setUserOpGasLimitEstimation] = useState<UserOpGasLimitEstimation | undefined>(undefined)
  const [status, setStatus] = useState<RequestStatus>(RequestStatus.NOT_REQUESTED)

  useEffect(() => {
    let isMounted = true
    async function estimate() {
      setStatus(RequestStatus.LOADING)

      try {
        const estimation = await estimateUserOpGasLimit(userOp, signerAddress)
        if (!isMounted) return
        // Increase the gas limit by 50%, otherwise the user op will fail during simulation with "verification more than gas limit" error
        estimation.verificationGasLimit = '0x' + ((BigInt(estimation.verificationGasLimit) * 15n) / 10n).toString(16)
        setUserOpGasLimitEstimation(estimation)
        setStatus(RequestStatus.SUCCESS)
      } catch (error) {
        if (!isMounted) return
        console.error(error)
        setStatus(RequestStatus.ERROR)
      }
    }

    estimate()

    return () => {
      isMounted = false
    }
  }, [userOp, signerAddress])

  return { userOpGasLimitEstimation, status }
}

export { useUserOpGasLimitEstimation }
