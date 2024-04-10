import { MaxUint256, encodeABI, encodeBase64, isBytesLike, toHexString } from '../utils/helper'
import type { BigNumberish, BytesLike } from '../utils/helper'
import CBOR from 'cbor'

/**
 * Returns the flag for the user verification requirement.
 *
 * See: <https://w3c.github.io/webauthn/#enumdef-userverificationrequirement>
 */
export function userVerificationFlag(userVerification: UserVerificationRequirement = 'preferred'): number {
  switch (userVerification) {
    case 'preferred':
      return 0x01
    case 'required':
      return 0x04
    default:
      throw new Error(`user verification requirement ${userVerification} not supported`)
  }
}

/**
 * Encode bytes using the Base64 URL encoding.
 *
 * See <https://www.rfc-editor.org/rfc/rfc4648#section-5>
 *
 * @param data data to encode to `base64url`
 * @returns the `base64url` encoded data as a string.
 */
export function base64UrlEncode(data: BytesLike | ArrayBufferLike): string {
  const bytes = isBytesLike(data) ? data : new Uint8Array(data)
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=*$/, '')
}

/**
 * Decodes the x and y coordinates of the public key from a created public key credential response.
 * Inspired from <https://webauthn.guide/#registration>.
 */
export function decodePublicKey(response: Pick<AuthenticatorAttestationResponse, 'attestationObject'>): { x: bigint; y: bigint } {
  const attestationObject = CBOR.decode(response.attestationObject)
  const authData = new DataView(
    attestationObject.authData.buffer,
    attestationObject.authData.byteOffset,
    attestationObject.authData.byteLength,
  )
  const credentialIdLength = authData.getUint16(53)
  const cosePublicKey = attestationObject.authData.slice(55 + credentialIdLength)
  const key: Map<number, unknown> = CBOR.decode(cosePublicKey)
  const bn = (bytes: Uint8Array) => BigInt('0x' + toHexString(bytes))
  return {
    x: bn(key.get(-2) as Uint8Array),
    y: bn(key.get(-3) as Uint8Array),
  }
}

/**
 * Decode the additional client data JSON fields. This is the fields other than `type` and
 * `challenge` (including `origin` and any other additional client data fields that may be added by
 * the authenticator).
 *
 * See <https://w3c.github.io/webauthn/#clientdatajson-serialization>
 */
export function decodeClientDataFields(response: Pick<AuthenticatorAssertionResponse, 'clientDataJSON'>): string {
  const clientDataJSON = new TextDecoder('utf-8').decode(response.clientDataJSON)
  const match = clientDataJSON.match(/^\{"type":"webauthn.get","challenge":"[A-Za-z0-9\-_]{43}",(.*)\}$/)

  if (!match) {
    throw new Error('challenge not found in client data JSON')
  }

  const [, fields] = match
  return fields
}

/**
 * Decode the signature R and S values from the authenticator response's DER-encoded signature.
 *
 * Note that this implementation assumes that all lengths in the DER encoding fit into 8-bit
 * integers, which is true for the kinds of signatures we are decoding but generally false. I.e.
 * **this code should not be used in any serious application**.
 *
 * See:
 * - <https://datatracker.ietf.org/doc/html/rfc3279#section-2.2.3>
 * - <https://en.wikipedia.org/wiki/X.690#BER_encoding>
 */
export function decodeSignature(response: Pick<AuthenticatorAssertionResponse, 'signature'>): { r: bigint; s: bigint } {
  const view = new DataView(response.signature)

  const check = (x: boolean) => {
    if (!x) {
      throw new Error('invalid signature encoding')
    }
  }
  const readInt = (offset: number) => {
    check(view.getUint8(offset) === 0x02)
    const len = view.getUint8(offset + 1)
    const start = offset + 2
    const end = start + len
    const n = BigInt('0x' + toHexString(new Uint8Array(view.buffer.slice(start, end))))
    check(n < MaxUint256)
    return [n, end] as const
  }

  // check that the sequence header is valid
  check(view.getUint8(0) === 0x30)
  check(view.getUint8(1) === view.byteLength - 2)

  // read R and S
  const [r, sOffset] = readInt(2)
  const [s] = readInt(sOffset)

  return { r, s }
}

/**
 * Encodes the given WebAuthn signature into a string. Used for testing purposes.
 *
 * @param authenticatorData - The authenticator data as a Uint8Array.
 * @param clientDataFields - The client data fields as a string.
 * @param r - The value of r as a bigint.
 * @param s - The value of s as a bigint.
 * @returns The encoded string.
 */
export function getSignatureBytes({
  authenticatorData,
  clientDataFields,
  r,
  s,
}: {
  authenticatorData: BytesLike
  clientDataFields: string
  r: BigNumberish
  s: BigNumberish
}): string {
  return encodeABI(['bytes', 'string', 'uint256', 'uint256'], [authenticatorData, clientDataFields, r, s])
}

/**
 * Encodes the signature bytes for a WebAuthn signer.
 */
export function encodeWebAuthnSignature(response: AuthenticatorAssertionResponse): string {
  const clientDataFields = decodeClientDataFields(response)
  const { r, s } = decodeSignature(response)

  return getSignatureBytes({
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataFields,
    r,
    s,
  })
}

/**
 * Dummy client data JSON fields. This can be used for gas estimations, as it pads the fields enough
 * to account for variations in WebAuthn implementations.
 */
export const DUMMY_CLIENT_DATA_FIELDS = [
  `"origin":"http://safe.global"`,
  `"padding":"This pads the clientDataJSON so that we can leave room for additional implementation specific fields for a more accurate 'preVerificationGas' estimate."`,
].join(',')

/**
 * Dummy authenticator data. This can be used for gas estimations, as it ensures that the correct
 * authenticator flags are set.
 */
export const DUMMY_AUTHENTICATOR_DATA = new Uint8Array(37)
// Authenticator data is the concatenation of:
// - 32 byte SHA-256 hash of the relying party ID
// - 1 byte for the user verification flag
// - 4 bytes for the signature count
// We fill it all with `0xfe` and set the appropriate user verification flag.
DUMMY_AUTHENTICATOR_DATA.fill(0xfe)
DUMMY_AUTHENTICATOR_DATA[32] = userVerificationFlag('required')
