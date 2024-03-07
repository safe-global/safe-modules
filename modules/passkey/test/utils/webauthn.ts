/**
 * This module provides a minimal shim to emulate the Web Authentication API implemented in browsers. This allows us to
 * write tests where we create and authenticate WebAuthn credentials that are verified on-chain.
 *
 * This implementation is inspired by software authenticators found in the Awesome WebAuthn list [1].
 *
 * [1]: <https://github.com/herrjemand/awesome-webauthn#software-authenticators>
 */

import { p256 } from '@noble/curves/p256'
import { ethers, BytesLike } from 'ethers'
import CBOR from 'cbor'

export interface CredentialCreationOptions {
  publicKey: PublicKeyCredentialCreationOptions
}

export type UserVerificationRequirement = 'required' | 'preferred' | 'discouraged'

/**
 * Public key credetial creation options, restricted to a subset of options that this module supports.
 * See <https://w3c.github.io/webauthn/#dictionary-makecredentialoptions>.
 */
export interface PublicKeyCredentialCreationOptions {
  rp: { id: string; name: string }
  user: { id: Uint8Array; displayName: string; name: string }
  challenge: Uint8Array
  pubKeyCredParams: {
    type: 'public-key'
    alg: number
  }[]
  attestation?: 'none'
  userVerification?: Exclude<UserVerificationRequirement, 'discouraged'>
}

export interface CredentialRequestOptions {
  publicKey: PublicKeyCredentialRequestOptions
}

/**
 * Public key credetial request options, restricted to a subset of options that this module supports.
 * See <https://w3c.github.io/webauthn/#dictionary-assertion-options>.
 */
export interface PublicKeyCredentialRequestOptions {
  challenge: Uint8Array
  rpId: string
  allowCredentials: {
    type: 'public-key'
    id: Uint8Array
  }[]
  userVerification?: Exclude<UserVerificationRequirement, 'discouraged'>
  attestation?: 'none'
}

/**
 * A created public key credential. See <https://w3c.github.io/webauthn/#iface-pkcredential>.
 */
export interface PublicKeyCredential<AuthenticatorResponse> {
  type: 'public-key'
  id: string
  rawId: ArrayBuffer
  response: AuthenticatorResponse
}

/**
 * The authenticator's response to a client’s request for the creation of a new public key credential.
 * See <https://w3c.github.io/webauthn/#iface-authenticatorattestationresponse>.
 */
export interface AuthenticatorAttestationResponse {
  clientDataJSON: ArrayBuffer
  attestationObject: ArrayBuffer
}

/**
 * The authenticator's response to a client’s request generation of a new authentication assertion given the WebAuthn Relying Party's challenge.
 * See <https://w3c.github.io/webauthn/#iface-authenticatorassertionresponse>.
 */
export interface AuthenticatorAssertionResponse {
  clientDataJSON: ArrayBuffer
  authenticatorData: ArrayBuffer
  signature: ArrayBuffer
  userHandle: ArrayBuffer
}

class Credential {
  public id: string
  public pk: bigint

  constructor(
    public rp: string,
    public user: Uint8Array,
  ) {
    this.pk = p256.utils.normPrivateKeyToScalar(p256.utils.randomPrivateKey())
    this.id = ethers.dataSlice(ethers.keccak256(ethers.dataSlice(p256.getPublicKey(this.pk, false), 1)), 12)
  }

  /**
   * Computes the COSE encoded public key for this credential.
   * See <https://datatracker.ietf.org/doc/html/rfc8152>.
   *
   * @returns Hex-encoded COSE-encoded public key
   */
  public cosePublicKey(): string {
    const pubk = p256.getPublicKey(this.pk, false)
    const x = pubk.subarray(1, 33)
    const y = pubk.subarray(33, 65)

    // <https://webauthn.guide/#registration>
    const key = new Map()
    // <https://datatracker.ietf.org/doc/html/rfc8152#section-13.1.1>
    key.set(-1, 1) // crv = P-256
    key.set(-2, b2ab(x))
    key.set(-3, b2ab(y))
    // <https://datatracker.ietf.org/doc/html/rfc8152#section-7>
    key.set(1, 2) // kty = EC2
    key.set(3, -7) // alg = ES256 (Elliptic curve signature with SHA-256)

    return ethers.hexlify(CBOR.encode(key))
  }
}

export class WebAuthnCredentials {
  #credentials: Credential[] = []

  /**
   * This is a shim for `navigator.credentials.create` method.
   * See <https://w3c.github.io/webappsec-credential-management/#dom-credentialscontainer-create>.
   *
   * @param options The public key credential creation options.
   * @returns A public key credential with an attestation response.
   */
  public create({ publicKey }: CredentialCreationOptions): PublicKeyCredential<AuthenticatorAttestationResponse> {
    if (!publicKey.pubKeyCredParams.some(({ alg }) => alg === -7)) {
      throw new Error('unsupported signature algorithm(s)')
    }

    const credential = new Credential(publicKey.rp.id, publicKey.user.id)
    this.#credentials.push(credential)

    // <https://w3c.github.io/webauthn/#dictionary-client-data>
    const clientData = {
      type: 'webauthn.create',
      challenge: base64UrlEncode(publicKey.challenge),
      origin: `https://${publicKey.rp.id}`,
    }

    // <https://w3c.github.io/webauthn/#sctn-attestation>
    const attestationObject = {
      authData: b2ab(
        ethers.getBytes(
          ethers.solidityPacked(
            ['bytes32', 'uint8', 'uint32', 'bytes16', 'uint16', 'bytes', 'bytes'],
            [
              ethers.sha256(ethers.toUtf8Bytes(publicKey.rp.id)),
              0x40 + userVerificationFlag(publicKey.userVerification), // flags = attested_data + user_present
              0, // signCount
              `0x${'42'.repeat(16)}`, // aaguid
              ethers.dataLength(credential.id),
              credential.id,
              credential.cosePublicKey(),
            ],
          ),
        ),
      ),
      fmt: 'none',
      attStmt: {},
    }

    return {
      id: base64UrlEncode(credential.id),
      rawId: ethers.getBytes(credential.id),
      response: {
        clientDataJSON: b2ab(ethers.toUtf8Bytes(JSON.stringify(clientData))),
        attestationObject: b2ab(CBOR.encode(attestationObject)),
      },
      type: 'public-key',
    }
  }

  /**
   * This is a shim for `navigator.credentials.get` method.
   * See <https://w3c.github.io/webappsec-credential-management/#dom-credentialscontainer-get>.
   *
   * @param options The public key credential request options.
   * @returns A public key credential with an assertion response.
   */
  get({ publicKey }: CredentialRequestOptions): PublicKeyCredential<AuthenticatorAssertionResponse> {
    const credential = publicKey.allowCredentials
      .flatMap(({ id }) => this.#credentials.filter((c) => c.rp === publicKey.rpId && c.id === ethers.hexlify(id)))
      .at(0)
    if (credential === undefined) {
      throw new Error('credential not found')
    }

    // <https://w3c.github.io/webauthn/#dictionary-client-data>
    const clientData = {
      type: 'webauthn.get',
      challenge: base64UrlEncode(publicKey.challenge),
      origin: `https://${publicKey.rpId}`,
    }

    // <https://w3c.github.io/webauthn/#sctn-authenticator-data>
    // Note that we use a constant 0 value for signCount to simplify things:
    // > If the authenticator does not implement a signature counter, let the signature counter
    // > value remain constant at zero.
    const authenticatorData = ethers.solidityPacked(
      ['bytes32', 'uint8', 'uint32'],
      [
        ethers.sha256(ethers.toUtf8Bytes(publicKey.rpId)),
        userVerificationFlag(publicKey.userVerification), // flags = user_present
        0, // signCount
      ],
    )

    // <https://w3c.github.io/webauthn/#sctn-op-get-assertion>
    // <https://w3c.github.io/webauthn/#fig-signature>
    const signature = p256.sign(
      ethers.getBytes(ethers.concat([authenticatorData, ethers.sha256(ethers.toUtf8Bytes(JSON.stringify(clientData)))])),
      credential.pk,
      {
        lowS: false,
        prehash: true,
      },
    )

    return {
      id: base64UrlEncode(credential.id),
      rawId: ethers.getBytes(credential.id),
      response: {
        clientDataJSON: b2ab(ethers.toUtf8Bytes(JSON.stringify(clientData))),
        authenticatorData: b2ab(ethers.getBytes(authenticatorData)),
        signature: b2ab(signature.toDERRawBytes(false)),
        userHandle: credential.user,
      },
      type: 'public-key',
    }
  }
}

function userVerificationFlag(userVerification: UserVerificationRequirement = 'preferred'): number {
  switch (userVerification) {
    case 'preferred':
      return 0x01
    case 'required':
      return 0x04
    default:
      throw new Error(`user verification requirement ${userVerification} not supported`)
  }
}

function b2ab(buf: Uint8Array): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
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
  const bytes = ethers.isBytesLike(data) ? data : new Uint8Array(data)
  return ethers.encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=*$/, '')
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
  const bn = (bytes: Uint8Array) => BigInt(ethers.hexlify(bytes))
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
  return ethers.hexlify(ethers.toUtf8Bytes(fields))
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
    const n = BigInt(ethers.hexlify(new Uint8Array(view.buffer.slice(start, end))))
    check(n < ethers.MaxUint256)
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
 * Encodes the signature bytes for a WebAuthn signer.
 */
export function encodeWebAuthnSignature(response: AuthenticatorAssertionResponse): string {
  const clientDataFields = decodeClientDataFields(response)
  const { r, s } = decodeSignature(response)

  return ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes', 'bytes', 'uint256', 'uint256'],
    [new Uint8Array(response.authenticatorData), clientDataFields, r, s],
  )
}
