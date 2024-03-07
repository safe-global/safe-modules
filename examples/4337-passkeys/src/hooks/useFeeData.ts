import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets'
import { RequestStatus } from '../utils'

/**
 * Custom hook that fetches fee data using the provided Eip1193Provider.
 * @param provider The Eip1193Provider instance.
 * @returns A tuple containing the fee data and the request status.
 */
function useFeeData(provider: ethers.Eip1193Provider): [ethers.FeeData | undefined, RequestStatus] {
  const [feeData, setFeeData] = useState<ethers.FeeData>()
  const [status, setStatus] = useState<RequestStatus>(RequestStatus.NOT_REQUESTED)

  useEffect(() => {
    if (provider) {
      setStatus(RequestStatus.LOADING)
      const jsonRpcProvider = getJsonRpcProviderFromEip1193Provider(provider)
      jsonRpcProvider
        .getFeeData()
        .then((feeData) => {
          setFeeData(feeData)
          setStatus(RequestStatus.SUCCESS)
        })
        .catch((error) => {
          console.error(error)
          setStatus(RequestStatus.ERROR)
        })
    }
  }, [provider])

  return [feeData, status]
}

export { useFeeData }
