/**
 * Tests to verify WebAuthn shim implementation from `utils/webauthn.ts`
 */

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { expect } from 'chai'
import { decode as cborDecode } from 'cbor-web'
import { ethers } from 'ethers'
import { WebAuthnCredentials } from '../../test/utils/webauthnShim'
import { base64UrlEncode } from '../../src/utils/webauthn'

describe('WebAuthn Shim', () => {
  const navigator = {
    credentials: new WebAuthnCredentials(),
  }

  const origin = 'https://safe.global'
  const rp = {
    name: 'Safe',
    id: 'safe.global',
  }

  const user = {
    id: ethers.getBytes(ethers.id('chucknorris')),
    name: 'chucknorris',
    displayName: 'Chuck Norris',
  }

  describe('navigator.credentials.create()', () => {
    it('Should create and verify a new credential', async () => {
      const options = await generateRegistrationOptions({
        rpName: rp.name,
        rpID: rp.id,
        userID: user.id,
        userName: user.name,
        userDisplayName: user.displayName,
        attestationType: 'none',
      })

      const credential = navigator.credentials.create({
        publicKey: {
          rp: {
            id: options.rp.id ?? '',
            name: options.rp.name,
          },
          user: {
            id: ethers.getBytes(ethers.decodeBase64(options.user.id)),
            displayName: options.user.displayName,
            name: options.user.name,
          },
          challenge: ethers.getBytes(ethers.decodeBase64(options.challenge)),
          pubKeyCredParams: options.pubKeyCredParams,
        },
      })

      const { verified } = await verifyRegistrationResponse({
        response: {
          id: credential.id,
          rawId: base64UrlEncode(credential.rawId),
          response: {
            clientDataJSON: base64UrlEncode(credential.response.clientDataJSON),
            attestationObject: base64UrlEncode(credential.response.attestationObject),
          },
          clientExtensionResults: {},
          type: 'public-key',
        },
        expectedChallenge: options.challenge,
        expectedOrigin: origin,
        expectedRPID: rp.id,
        requireUserVerification: false,
      })

      expect(verified).to.be.true
    })
  })

  describe('navigator.credentials.get()', () => {
    it('Should authorise and verify an existing credential', async () => {
      const credential = navigator.credentials.create({
        publicKey: {
          rp,
          user,
          challenge: ethers.toUtf8Bytes('challenge accepted!'),
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        },
      })

      const attestationObject = cborDecode(credential.response.attestationObject)
      const authData = new DataView(
        attestationObject.authData.buffer,
        attestationObject.authData.byteOffset,
        attestationObject.authData.byteLength,
      )
      const credentialIdLength = authData.getUint16(53)
      const credentialPublicKey = attestationObject.authData.slice(55 + credentialIdLength)

      const options = await generateAuthenticationOptions({
        rpID: rp.id,
      })

      const assertion = navigator.credentials.get({
        publicKey: {
          challenge: ethers.getBytes(ethers.decodeBase64(options.challenge)),
          rpId: rp.id,
          allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
        },
      })

      const { verified } = await verifyAuthenticationResponse({
        response: {
          id: assertion.id,
          rawId: base64UrlEncode(assertion.rawId),
          response: {
            clientDataJSON: base64UrlEncode(assertion.response.clientDataJSON),
            authenticatorData: base64UrlEncode(assertion.response.authenticatorData),
            signature: base64UrlEncode(assertion.response.signature),
          },
          type: 'public-key',
          clientExtensionResults: {},
        },
        expectedChallenge: options.challenge,
        expectedOrigin: origin,
        expectedRPID: rp.id,
        authenticator: {
          credentialPublicKey,
          credentialID: credential.rawId.toString(),
          counter: 0,
        },
        requireUserVerification: false,
      })

      expect(verified).to.be.true
    })
  })
})
