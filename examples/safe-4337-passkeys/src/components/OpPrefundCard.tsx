import { ethers } from 'ethers'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets'
import { useState } from 'react'

function PrefundCard({
  provider,
  requiredPrefund,
  safeAddress,
}: {
  provider: ethers.Eip1193Provider
  requiredPrefund: bigint
  safeAddress: string
}) {
  const [loading, setLoading] = useState(false)

  const handlePrefundClick = async () => {
    setLoading(true)
    const jsonRpcProvider = getJsonRpcProviderFromEip1193Provider(provider)

    const signer = await jsonRpcProvider.getSigner()

    try {
      await signer
        .sendTransaction({
          to: safeAddress,
          value: requiredPrefund,
        })
        .then((tx) => tx.wait(1))
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <p>You need to prefund your safe with {requiredPrefund.toString()} wei. Click the button below to prefund your safe.</p>

      <button onClick={handlePrefundClick} disabled={loading}>
        {loading ? 'Confirming tx' : 'Prefund'}
      </button>
    </div>
  )
}

export { PrefundCard }
