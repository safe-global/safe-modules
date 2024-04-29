import { Navigate, redirect, useLoaderData } from 'react-router-dom'
import { getPasskeyFromLocalStorage, PasskeyLocalStorageFormat } from '../logic/passkeys.ts'
import { encodeSetupCall, getSafeAddress, getSafeInitializer } from '../logic/safe.ts'
import {
  P256_VERIFIER_ADDRESS,
  SAFE_4337_MODULE_ADDRESS,
  SAFE_SINGLETON_WEBAUTHN_SIGNER_ADDRESS,
  SAFE_MULTISEND_ADDRESS,
} from '../config.ts'
import { useCodeAtAddress } from '../hooks/useCodeAtAddress.ts'
import { RequestStatus } from '../utils.ts'
import { DEPLOY_SAFE_ROUTE, CREATE_PASSKEY_ROUTE, getSafeRoute } from './constants.ts'

import { useOutletContext } from '../hooks/UseOutletContext.tsx'

type LoaderData = {
  passkey: PasskeyLocalStorageFormat
  safeAddress: string
}

async function loader(): Promise<Response | LoaderData> {
  const passkey = getPasskeyFromLocalStorage()
  if (!passkey) {
    return redirect(CREATE_PASSKEY_ROUTE)
  }

  const setupData = encodeSetupCall([SAFE_4337_MODULE_ADDRESS], { ...passkey.pubkeyCoordinates, verifiers: P256_VERIFIER_ADDRESS })
  const initializer = getSafeInitializer(
    [SAFE_SINGLETON_WEBAUTHN_SIGNER_ADDRESS],
    1,
    SAFE_4337_MODULE_ADDRESS,
    SAFE_MULTISEND_ADDRESS,
    setupData,
  )
  const safeAddress = getSafeAddress(initializer)

  return { passkey, safeAddress }
}

// This page doesn't have a UI, it just determines where to redirect the user based on the state.
function Home() {
  const { safeAddress, passkey } = useLoaderData() as LoaderData
  const { walletProvider } = useOutletContext()
  const [safeCode, requestStatus] = useCodeAtAddress(walletProvider, safeAddress)

  if (requestStatus === RequestStatus.LOADING) {
    return <p>Loading...</p>
  }

  if (requestStatus === RequestStatus.SUCCESS && safeCode !== '0x') {
    return <Navigate to={getSafeRoute(safeAddress)} />
  }

  if (requestStatus === RequestStatus.SUCCESS && safeCode === '0x') {
    return <Navigate to={DEPLOY_SAFE_ROUTE} state={{ passkey }} />
  }

  return <p>You shouldn't have landed on this page, but somehow you did it! Here's an Easter egg for you: 🐣</p>
}

export { Home, loader }
