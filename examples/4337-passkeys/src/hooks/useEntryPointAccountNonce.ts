import { Eip1193Provider } from 'ethers'
import { getNonceFromEntryPoint } from '../logic/userOp.ts'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets.ts'
import { useEffect, useState } from 'react'
import { RequestStatus } from '../utils.ts'

function useEntryPointAccountNonce(
  walletProvider: Eip1193Provider,
  safeAddress: string,
  opts: { pollInterval: number } = { pollInterval: 5000 },
): [bigint | null, RequestStatus] {
  const [nonce, setNonce] = useState<bigint | null>(null)
  const [status, setStatus] = useState<RequestStatus>(RequestStatus.NOT_REQUESTED)

  useEffect(() => {
    let cancelled = false

    const fetchNonce = async () => {
      if (cancelled) return
      setStatus(RequestStatus.LOADING)
      try {
        const provider = getJsonRpcProviderFromEip1193Provider(walletProvider)
        const newNonce = await getNonceFromEntryPoint(provider, safeAddress)
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

    fetchNonce()

    const interval = setInterval(fetchNonce, opts.pollInterval)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [walletProvider, safeAddress, opts.pollInterval])

  return [nonce, status]
}

export { useEntryPointAccountNonce }
