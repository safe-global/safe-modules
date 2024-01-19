import { ethers } from 'ethers'
import { getJsonRpcProviderFromEip1193Provider } from '../logic/wallets'

function PrefundCard({
  provider,
  requiredPrefund,
  safeAddress,
}: {
  provider: ethers.Eip1193Provider
  requiredPrefund: bigint
  safeAddress: string
}) {
  const handlePrefundClick = async () => {
    const jsonRpcProvider = getJsonRpcProviderFromEip1193Provider(provider)

    const signer = await jsonRpcProvider.getSigner()

    await signer.sendTransaction({
      to: safeAddress,
      value: requiredPrefund,
    })
  }

  return (
    <div className="card">
      <p>Required prefund: {requiredPrefund.toString()}</p>

      <button onClick={handlePrefundClick}>Prefund</button>
    </div>
  )
}

export { PrefundCard }
