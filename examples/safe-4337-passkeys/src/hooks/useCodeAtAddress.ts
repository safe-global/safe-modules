import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets'
import { RequestStatus } from '../utils'

type Options = {
  pollInterval?: number
}

function useCodeAtAddress(provider: ethers.Eip1193Provider, address: string, opts?: Options): [string, RequestStatus] {
  const [code, setCode] = useState<string>('')
  const [status, setStatus] = useState<RequestStatus>(RequestStatus.NOT_REQUESTED)

  useEffect(() => {
    let cancelled = false

    async function updateBalance() {
      try {
        const jsonRpcProvider = getJsonRpcProviderFromEip1193Provider(provider)
        const balance = await jsonRpcProvider.getCode(address)
        if (!cancelled) {
          setCode(balance)
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

  return [code, status]
}

export { useCodeAtAddress }
