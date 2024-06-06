import { ethers } from 'ethers'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets'
import { useMemo, useState } from 'react'

function MissingAccountFundsCard({
  provider,
  missingAccountFunds,
  safeAddress,
}: {
  provider: ethers.Eip1193Provider
  missingAccountFunds: bigint
  safeAddress: string
}) {
  const [loading, setLoading] = useState(false)
  const ethFormatted = useMemo(() => ethers.formatEther(missingAccountFunds), [missingAccountFunds])

  const handlePrefundClick = async () => {
    setLoading(true)
    const jsonRpcProvider = getJsonRpcProviderFromEip1193Provider(provider)

    const signer = await jsonRpcProvider.getSigner()

    try {
      await signer
        .sendTransaction({
          to: safeAddress,
          value: missingAccountFunds,
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
      <p>You need to prefund your safe with {ethFormatted} ETH. Click the button below to prefund your safe.</p>

      <button onClick={handlePrefundClick} disabled={loading}>
        {loading ? 'Confirming tx' : 'Prefund'}
      </button>
    </div>
  )
}

export { MissingAccountFundsCard }
