import { useState } from "react"
import ConnectButton from "./components/ConnectButton"
import safeLogo from "/safe-logo.svg"
import { createPasskey, isLocalStoragePasskey, toLocalStorageFormat } from "./logic/passkeys.ts"
import "./App.css"
import { setItem } from "./logic/storage.ts"

const PASSKEY_LOCALSTORAGE_KEY = "passkeyId"

function App() {
  const [savedPasskey] = useState(() => {
    const savedData = localStorage.getItem("data")
    if (!savedData) {
      return null
    }

    const savedDataJson = JSON.parse(savedData)
    if (isLocalStoragePasskey(savedDataJson)) {
      return savedDataJson
    }

    return null
  })

  const handleCreatePasskeyClick = async () => {
    const passkey = await createPasskey()

    setItem(PASSKEY_LOCALSTORAGE_KEY, toLocalStorageFormat(passkey))
  }

  return (
    <>
      <div>
        <a href="https://safe.global" target="_blank">
          <img src={safeLogo} className="logo" alt="Safe logo" />
        </a>
      </div>
      <h1>Safe + 4337 + Passkeys demo</h1>
      <div className="card">
        <ConnectButton />
      </div>
      <div className="card">
        <button onClick={handleCreatePasskeyClick}>Create Passkey</button>
      </div>
    </>
  )
}

// https://web.dev/articles/passkey-registration

export default App
