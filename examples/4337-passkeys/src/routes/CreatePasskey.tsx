import { useState } from 'react'
import { redirect, useNavigate } from 'react-router-dom'
import { DEPLOY_SAFE_ROUTE, HOME_ROUTE } from './constants.ts'
import { createPasskey, getPasskeyFromLocalStorage, storePasskeyInLocalStorage } from '../logic/passkeys.ts'

async function loader() {
  const passkey = getPasskeyFromLocalStorage()
  if (passkey) {
    return redirect(HOME_ROUTE)
  }

  return null
}

function CreatePasskey() {
  const [error, setError] = useState<string>()
  const navigate = useNavigate()

  const handleCreatePasskeyClick = async () => {
    setError(undefined)
    try {
      const passkey = await createPasskey()

      storePasskeyInLocalStorage(passkey)

      navigate(DEPLOY_SAFE_ROUTE, { replace: true })
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Unknown error')
      }
    }
  }

  return (
    <div className="card">
      <p>First, create a passkey to sign transactions</p>
      <p style={{ opacity: '0.75' }}>
        Passkey is a secure authentication method that replaces traditional passwords. It uses public key cryptography and unique
        cryptographic keys to securely log users into websites and apps. To access a passkey, users must unlock their devices using
        biometrics like a fingerprint, Face ID or a device PIN. This makes passkeys much more secure than passwords and resistant to
        phishing attacks.
        <br />
        For the Safe Account, passkeys serve as credentials for verifying user operations on-chain. This added layer of authentication
        ensures that only the passkey holder can access and perform actions with the account.
      </p>
      <button onClick={handleCreatePasskeyClick}>Create Passkey</button>

      {error && (
        <div className="card">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  )
}

export { CreatePasskey, loader }
