import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets'
import { RequestStatus } from '../utils'

type FeeData = Omit<ethers.FeeData, 'toJSON'>

/**
 * Applies a multiplier to the provided fee data. Pimlico bundler started requiring
 * a 1.2x multiplier on gas prices. Customize it for your bundler or use their proprietary
 * method that will return the prices with the multiplier applied.
 * @param feeData The fee data to apply the multiplier to.
 * @param multiplier The multiplier to apply to the fee data.
 * @returns The fee data with the multiplier applied.
 */
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
    let isMounted = true

    setStatus(RequestStatus.LOADING)
    const jsonRpcProvider = getJsonRpcProviderFromEip1193Provider(provider)
    jsonRpcProvider
      .getFeeData()
      .then((feeData) => {
        if (!isMounted) return
        setFeeData(applyMultiplier(feeData))
        setStatus(RequestStatus.SUCCESS)
      })
      .catch((error) => {
        if (!isMounted) return
        console.error(error)
        setStatus(RequestStatus.ERROR)
      })

    return () => {
      isMounted = false
    }
  }, [provider])

  return [feeData, status]
}

export { useFeeData }
