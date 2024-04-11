import type { Eip1193Provider } from 'ethers'
import { switchToSepolia } from '../logic/wallets.ts'
import { useState } from 'react'

function SwitchNetwork({ walletProvider }: { walletProvider: Eip1193Provider }) {
  const [error, setError] = useState<string>()

  const handleSwitchToSepoliaClick = () => {
    setError(undefined)
    try {
      switchToSepolia(walletProvider)
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Unknown error when switching to Ethereum Sepolia test network')
      }
    }
  }

  return (
    <div className="card">
      <p>Please switch to Ethereum Sepolia test network to continue</p>
      <button onClick={handleSwitchToSepoliaClick}>Switch to Sepolia</button>
      {error && <p>Error: {error}</p>}
    </div>
  )
}

export { SwitchNetwork }
