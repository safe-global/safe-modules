import { useMemo } from 'react'

import { PasskeyLocalStorageFormat } from '../logic/passkeys'
import { getSignerAddressFromPubkeyCoords } from '../logic/safe'

function PasskeyCard({ passkey, handleCreatePasskeyClick }: { passkey?: PasskeyLocalStorageFormat; handleCreatePasskeyClick: () => void }) {
  const predictedSignerAddress = useMemo(() => {
    if (!passkey) return undefined

    return getSignerAddressFromPubkeyCoords(passkey.pubkeyCoordinates.x, passkey.pubkeyCoordinates.y)
  }, [passkey])

  return passkey ? (
    <div className="card">
      <p>
        Passkey ID: {passkey.rawId}
        <br />
        Passkey X: {passkey.pubkeyCoordinates.x}
        <br />
        Passkey Y: {passkey.pubkeyCoordinates.y}
        <br />
        Predicted Signer Address: {predictedSignerAddress}
      </p>
    </div>
  ) : (
    <div className="card">
      <button onClick={handleCreatePasskeyClick}>Create Passkey</button>
    </div>
  )
}

export { PasskeyCard }
