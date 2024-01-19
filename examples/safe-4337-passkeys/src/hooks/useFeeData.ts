import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets'
import { RequestStatus } from '../utils'

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
