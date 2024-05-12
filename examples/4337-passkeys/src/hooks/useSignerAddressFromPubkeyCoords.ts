import { getSignerAddressFromPubkeyCoords } from '../logic/safe.ts'
import { RequestStatus } from '../utils.ts'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets.ts'

/**
 * Custom hook for getting the signer address from the pubkey coordinates.
 * @param x The x coordinate of the pubkey.
 * @param y The y coordinate of the pubkey.
 * @returns The signer address.
 */
function useSignerAddressFromPubkeyCoords(provider: ethers.Eip1193Provider, x: string, y: string): [string | null, RequestStatus] {
  const [signerAddress, setSignerAddress] = useState<string | null>(null)
  const [status, setStatus] = useState<RequestStatus>(RequestStatus.NOT_REQUESTED)

  useEffect(() => {
    let isMounted = true
    async function getSignerAddress() {
      setStatus(RequestStatus.LOADING)

      try {
        const address = await getSignerAddressFromPubkeyCoords(getJsonRpcProviderFromEip1193Provider(provider), x, y)
        if (!isMounted) return
        setSignerAddress(address)
        setStatus(RequestStatus.SUCCESS)
      } catch (error) {
        if (!isMounted) return
        console.error(error)
        setStatus(RequestStatus.ERROR)
      }
    }

    getSignerAddress()

    return () => {
      isMounted = false
    }
  }, [provider, x, y])

  return [signerAddress, status]
}

export { useSignerAddressFromPubkeyCoords }
