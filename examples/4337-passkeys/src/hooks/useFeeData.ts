import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets'
import { RequestStatus } from '../utils'

type FeeData = Omit<ethers.FeeData, 'toJSON'>

function applyMultiplier(feeData: FeeData, multiplier: bigint = 120n): FeeData {
  if (!feeData.gasPrice || !feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) return feeData

  return {
    gasPrice: (feeData.gasPrice * multiplier) / 100n,
    maxFeePerGas: (feeData.maxFeePerGas * multiplier) / 100n,
    maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas * multiplier) / 100n,
  }
}

/**
 * Custom hook that fetches fee data using the provided Eip1193Provider.
 * @param provider The Eip1193Provider instance.
 * @returns A tuple containing the fee data and the request status.
 */
function useFeeData(provider: ethers.Eip1193Provider): [FeeData | undefined, RequestStatus] {
  const [feeData, setFeeData] = useState<FeeData>()
  const [status, setStatus] = useState<RequestStatus>(RequestStatus.NOT_REQUESTED)

  useEffect(() => {
    if (provider) {
      setStatus(RequestStatus.LOADING)
      const jsonRpcProvider = getJsonRpcProviderFromEip1193Provider(provider)
      jsonRpcProvider
        .getFeeData()
        .then((feeData) => {
          setFeeData(applyMultiplier(feeData))
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
