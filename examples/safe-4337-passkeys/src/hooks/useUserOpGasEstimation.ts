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
