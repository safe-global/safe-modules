import { Eip1193Provider } from 'ethers'
import { getAccountEntryPointBalance } from '../logic/userOp.ts'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets.ts'
import { useEffect, useState } from 'react'
import { RequestStatus } from '../utils.ts'

function useEntryPointAccountBalance(
  walletProvider: Eip1193Provider,
  safeAddress: string,
  opts: { pollInterval: number } = { pollInterval: 5000 },
): [bigint | null, RequestStatus] {
  const [nonce, setNonce] = useState<bigint | null>(null)
  const [status, setStatus] = useState<RequestStatus>(RequestStatus.NOT_REQUESTED)

  useEffect(() => {
    let cancelled = false

    const fetchBalance = async () => {
      if (cancelled) return
      setStatus(RequestStatus.LOADING)
      try {
        const provider = getJsonRpcProviderFromEip1193Provider(walletProvider)
        const newNonce = await getAccountEntryPointBalance(provider, safeAddress)
        if (!cancelled) {
          setNonce(newNonce)
          setStatus(RequestStatus.SUCCESS)
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(RequestStatus.ERROR)
          console.error('Error fetching nonce:', error)
        }
      }
    }

    fetchBalance()

    const interval = setInterval(fetchBalance, opts.pollInterval)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [walletProvider, safeAddress, opts.pollInterval])

  return [nonce, status]
}

export { useEntryPointAccountBalance }
