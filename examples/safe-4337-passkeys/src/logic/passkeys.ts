type PasskeyCredential = {
  id: 'string'
  rawId: ArrayBuffer
  response: {
    clientDataJSON: ArrayBuffer
    attestationObject: ArrayBuffer
    getPublicKey(): ArrayBuffer
  }
  type: 'public-key'
}

type PasskeyCredentialWithPubkeyCoordinates = PasskeyCredential & {
  pubkeyCoordinates: {
    x: string
    y: string
  }
}

/**
 * Creates a passkey for signing.
 *
 * @returns A promise that resolves to a PasskeyCredentialWithPubkeyCoordinates object, which includes the passkey credential information and its public key coordinates.
 * @throws Throws an error if the passkey generation fails or if the credential received is null.
 */
async function createPasskey(): Promise<PasskeyCredentialWithPubkeyCoordinates> {
  // Generate a passkey credential using WebAuthn API
  const passkeyCredential = (await navigator.credentials.create({
    publicKey: {
      pubKeyCredParams: [
        {
          // ECDSA w/ SHA-256: https://datatracker.ietf.org/doc/html/rfc8152#section-8.1
          alg: -7,
          type: 'public-key',
        },
      ],
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: {
        name: 'Safe Wallet',
      },
      user: {
        displayName: 'Safe Owner',
        id: crypto.getRandomValues(new Uint8Array(32)),
        name: 'safe-owner',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PasskeyCredential | null

  if (!passkeyCredential) {
    throw new Error('Failed to generate passkey. Received null as a credential')
  }

  // Import the public key to later export it to get the XY coordinates
  const key = await crypto.subtle.importKey(
    'spki',
    passkeyCredential.response.getPublicKey(),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
      hash: { name: 'SHA-256' },
    },
    true, // boolean that marks the key as an exportable one
    ['verify'],
  )

  // Export the public key in JWK format and extract XY coordinates
  const exportedKeyWithXYCoordinates = await crypto.subtle.exportKey('jwk', key)
  if (!exportedKeyWithXYCoordinates.x || !exportedKeyWithXYCoordinates.y) {
    throw new Error('Failed to retrieve x and y coordinates')
  }

  // Create a PasskeyCredentialWithPubkeyCoordinates object
  const passkeyWithCoordinates: PasskeyCredentialWithPubkeyCoordinates = Object.assign(passkeyCredential, {
    pubkeyCoordinates: {
      x: Buffer.from(exportedKeyWithXYCoordinates.x, 'base64').toString('hex'),
      y: Buffer.from(exportedKeyWithXYCoordinates.y, 'base64').toString('hex'),
    },
  })

  return passkeyWithCoordinates
}

export type PasskeyLocalStorageFormat = {
  rawId: string
  pubkeyCoordinates: {
    x: string
    y: string
  }
}

/**
 * Converts a PasskeyCredentialWithPubkeyCoordinates object to a format that can be stored in the local storage.
 * The rawId is required for signing and pubkey coordinates are for our convenience.
 * @param passkey - The passkey to be converted.
 * @returns The passkey in a format that can be stored in the local storage.
 */
function toLocalStorageFormat(passkey: PasskeyCredentialWithPubkeyCoordinates): PasskeyLocalStorageFormat {
  return {
    rawId: Buffer.from(passkey.rawId).toString('hex'),
    pubkeyCoordinates: passkey.pubkeyCoordinates,
  }
}

/**
 * Checks if the provided value is in the format of a Local Storage Passkey.
 * @param x The value to check.
 * @returns A boolean indicating whether the value is in the format of a Local Storage Passkey.
 */
function isLocalStoragePasskey(x: unknown): x is PasskeyLocalStorageFormat {
  return typeof x === 'object' && x !== null && 'rawId' in x && 'pubkeyCoordinates' in x
}

export { createPasskey, toLocalStorageFormat, isLocalStoragePasskey }
