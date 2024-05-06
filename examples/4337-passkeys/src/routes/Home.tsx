import { Navigate, redirect, useLoaderData } from 'react-router-dom'
import { getPasskeyFromLocalStorage, PasskeyLocalStorageFormat } from '../logic/passkeys.ts'
import { encodeSafeModuleSetupCall, getLaunchpadInitializer, getSafeAddress, type SafeInitializer } from '../logic/safe.ts'
import {
  P256_VERIFIER_ADDRESS,
  SAFE_4337_MODULE_ADDRESS,
  SAFE_MODULE_SETUP_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  WEBAUTHN_SIGNER_FACTORY_ADDRESS,
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

  const initializer: SafeInitializer = {
    singleton: SAFE_SINGLETON_ADDRESS,
    fallbackHandler: SAFE_4337_MODULE_ADDRESS,
    signerFactory: WEBAUTHN_SIGNER_FACTORY_ADDRESS,
    signerX: passkey.pubkeyCoordinates.x,
    signerY: passkey.pubkeyCoordinates.y,
    signerVerifiers: P256_VERIFIER_ADDRESS,
    setupTo: SAFE_MODULE_SETUP_ADDRESS,
    setupData: encodeSafeModuleSetupCall([SAFE_4337_MODULE_ADDRESS]),
  }
  const launchpadInitializer = getLaunchpadInitializer(initializer)
  const safeAddress = getSafeAddress(launchpadInitializer)

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
