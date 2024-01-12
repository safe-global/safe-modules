import safeLogo from '/safe-logo.svg'
import { PasskeyLocalStorageFormat, createPasskey, toLocalStorageFormat } from './logic/passkeys.ts'
import './App.css'
import { useLocalStorageState } from './hooks/useLocalStorageState.ts'
import ConnectButton from './components/ConnectButton.tsx'
import { useState } from 'react'
import { useWeb3ModalProvider, useWeb3ModalAccount } from '@web3modal/ethers/react'
import { APP_CHAIN_ID } from './config.ts'
import { switchToMumbai } from './logic/wallets.ts'
const PASSKEY_LOCALSTORAGE_KEY = 'passkeyId'

function App() {
  const [passkey, setPasskey] = useLocalStorageState<PasskeyLocalStorageFormat | null>(PASSKEY_LOCALSTORAGE_KEY, null)
  const [error, setError] = useState<string>()
  const { chainId } = useWeb3ModalAccount()
  const { walletProvider } = useWeb3ModalProvider()

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

  const handleSwitchToMumbaiClick = () => {
    if (!walletProvider) return

    setError(undefined)
    try {
      switchToMumbai(walletProvider)
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Unknown error when switching to Mumbai network')
      }
    }
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

      {Boolean(walletProvider) && chainId !== APP_CHAIN_ID && (
        <div className="card">
          <p>Please switch to Mumbai network to continue</p>
          <button onClick={handleSwitchToMumbaiClick}>Switch to Mumbai</button>
        </div>
      )}

      {passkey ? (
        <div className="card">
          <p>
            Passkey ID: {passkey.rawId}
            <br />
            Passkey X: {passkey.pubkeyCoordinates.x}
            <br />
            Passkey Y: {passkey.pubkeyCoordinates.y}
          </p>
        </div>
      ) : (
        <div className="card">
          <button onClick={handleCreatePasskeyClick}>Create Passkey</button>
        </div>
      )}

      {error && (
        <div className="card">
          <p>Error: {error}</p>
        </div>
      )}
    </>
  )
}

// https://web.dev/articles/passkey-registration

export default App
