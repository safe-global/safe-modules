import safeLogo from '/safe-logo.svg'
import { PasskeyLocalStorageFormat, createPasskey, toLocalStorageFormat } from './logic/passkeys.ts'
import './App.css'
import { useLocalStorageState } from './hooks/useLocalStorageState.ts'
import ConnectButton from './components/ConnectButton.tsx'
import { useState } from 'react'
import { useWeb3ModalProvider, useWeb3ModalAccount } from '@web3modal/ethers/react'
import { APP_CHAIN_ID } from './config.ts'
import { switchToSepolia } from './logic/wallets.ts'
import { PasskeyCard } from './components/PasskeyCard.tsx'
import { SafeCard } from './components/SafeCard.tsx'

const PASSKEY_LOCALSTORAGE_KEY = 'passkeyId'

function App() {
  const [passkey, setPasskey] = useLocalStorageState<PasskeyLocalStorageFormat | undefined>(PASSKEY_LOCALSTORAGE_KEY, undefined)
  const [error, setError] = useState<string>()
  const { chainId } = useWeb3ModalAccount()
  const { walletProvider } = useWeb3ModalProvider()
  const connectedToWrongChain = Boolean(walletProvider) && chainId !== APP_CHAIN_ID

  const handleCreatePasskeyClick = async () => {
    setError(undefined)
    try {
      const passkey = await createPasskey()

      setPasskey(toLocalStorageFormat(passkey))
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Unknown error')
      }
    }
  }

  const handleSwitchToSepoliaClick = () => {
    if (!walletProvider) return

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

  let content = (
    <>
      <PasskeyCard passkey={passkey} handleCreatePasskeyClick={handleCreatePasskeyClick} />

      {passkey && walletProvider && <SafeCard passkey={passkey} provider={walletProvider} />}

      {error && (
        <div className="card">
          <p>Error: {error}</p>
        </div>
      )}
    </>
  )
  if (!walletProvider) {
    content = (
      <div className="card">
        <p>Please connect wallet to continue</p>
      </div>
    )
  }
  if (connectedToWrongChain) {
    content = (
      <div className="card">
        <p>Please switch to Ethereum Sepolia test network to continue</p>
        <button onClick={handleSwitchToSepoliaClick}>Switch to Sepolia</button>
      </div>
    )
  }

  return (
    <>
      <header className="header">
        <a href="https://safe.global" target="_blank">
          <img src={safeLogo} className="logo" alt="Safe logo" />
        </a>

        <div className="card">
          <ConnectButton />
        </div>
      </header>
      <h1>Safe + 4337 + Passkeys demo</h1>

      {content}
    </>
  )
}

export default App
