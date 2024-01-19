import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets'
import { RequestStatus } from '../utils'

type Options = {
  pollInterval?: number
}

function useNativeTokenBalance(provider: ethers.Eip1193Provider, address: string, opts?: Options): [bigint, RequestStatus] {
  const [balance, setBalance] = useState<bigint>(0n)
  const [status, setStatus] = useState<RequestStatus>(RequestStatus.NOT_REQUESTED)

  useEffect(() => {
    let cancelled = false

    async function updateBalance() {
      try {
        const jsonRpcProvider = getJsonRpcProviderFromEip1193Provider(provider)
        const balance = await jsonRpcProvider.getBalance(address)
        if (!cancelled) {
          setBalance(balance)
          setStatus(RequestStatus.SUCCESS)
        }
      } catch (e) {
        if (!cancelled) {
          setStatus(RequestStatus.ERROR)
        }
      }
    }

    if (provider) {
      const pollInterval = opts?.pollInterval || 5000

      updateBalance()
      const interval = setInterval(updateBalance, pollInterval)

      return () => {
        cancelled = true
        clearInterval(interval)
      }
    }
  }, [provider, address, opts?.pollInterval])

  return [balance, status]
}

export { useNativeTokenBalance }
