import { useState, useEffect } from 'react'
import { UnsignedUserOperation, UserOpGasLimitEstimation, estimateUserOpGasLimit } from '../logic/userOp'
import { RequestStatus } from '../utils'

function useUserOpGasLimitEstimation(userOp: UnsignedUserOperation) {
  const [userOpGasLimitEstimation, setUserOpGasLimitEstimation] = useState<UserOpGasLimitEstimation | undefined>(undefined)
  const [status, setStatus] = useState<RequestStatus>(RequestStatus.NOT_REQUESTED)

  useEffect(() => {
    async function estimate() {
      setStatus(RequestStatus.LOADING)

      try {
        const estimation = await estimateUserOpGasLimit(userOp)
        // Increase the gas limit by 50%, otherwise the user op will fail during simulation with "verification more than gas limit" error
        estimation.verificationGasLimit = '0x' + ((BigInt(estimation.verificationGasLimit) * 15n) / 10n).toString(16)
        setUserOpGasLimitEstimation(estimation)
        setStatus(RequestStatus.SUCCESS)
      } catch (error) {
        console.error(error)
        setStatus(RequestStatus.ERROR)
      }
    }

    estimate()
  }, [userOp])

  return { userOpGasLimitEstimation, status }
}

export { useUserOpGasLimitEstimation }
