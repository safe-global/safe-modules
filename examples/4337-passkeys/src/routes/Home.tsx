import { Navigate, redirect, useLoaderData, useOutletContext } from 'react-router-dom'
import { getPasskeyFromLocalStorage, PasskeyLocalStorageFormat } from '../logic/passkeys.ts'
import {
  encodeSafeModuleSetupCall,
  getInitHash,
  getLaunchpadInitializer,
  getSafeAddress,
  getSignerAddressFromPubkeyCoords,
  type SafeInitializer,
} from '../logic/safe.ts'
import {
  APP_CHAIN_ID,
  P256_VERIFIER_ADDRESS,
  SAFE_4337_MODULE_ADDRESS,
  SAFE_MODULE_SETUP_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  WEBAUTHN_SIGNER_FACTORY_ADDRESS,
} from '../config.ts'
import { useCodeAtAddress } from '../hooks/useCodeAtAddress.ts'
import { RequestStatus } from '../utils.ts'
import { DEPLOY_SAFE, CREATE_PASSKEY, getSafeRoute } from './constants.ts'
import { OutletContext } from '../types/Outlet.ts'

type LoaderData = {
  passkey: PasskeyLocalStorageFormat
  passkeySignerAddress: string
  safeAddress: string
}

async function loader(): Promise<Response | LoaderData> {
  const passkey = getPasskeyFromLocalStorage()
  if (!passkey) {
    return redirect(CREATE_PASSKEY)
  }

  const passkeySignerAddress = getSignerAddressFromPubkeyCoords(passkey.pubkeyCoordinates.x, passkey.pubkeyCoordinates.y)
  const initializer: SafeInitializer = {
    singleton: SAFE_SINGLETON_ADDRESS,
    fallbackHandler: SAFE_4337_MODULE_ADDRESS,
    signerFactory: WEBAUTHN_SIGNER_FACTORY_ADDRESS,
    signerX: passkey.pubkeyCoordinates.x,
    signerY: passkey.pubkeyCoordinates.y,
    signerVerifier: P256_VERIFIER_ADDRESS,
    setupTo: SAFE_MODULE_SETUP_ADDRESS,
    setupData: encodeSafeModuleSetupCall([SAFE_4337_MODULE_ADDRESS]),
  }
  const initHash = getInitHash(initializer, APP_CHAIN_ID)
  const launchpadInitializer = getLaunchpadInitializer(initHash)
  const safeAddress = getSafeAddress(launchpadInitializer)

  return { passkey, passkeySignerAddress, safeAddress }
}

// This page doesn't have a UI, it just determines where to redirect the user based on the state.
function Home() {
  const { safeAddress, passkey } = useLoaderData() as LoaderData
  const { walletProvider } = useOutletContext<OutletContext>()
  const [safeCode, requestStatus] = useCodeAtAddress(walletProvider, safeAddress)

  if (requestStatus === RequestStatus.SUCCESS && safeCode !== '0x') {
    return <Navigate to={getSafeRoute(safeAddress)} />
  }

  if (requestStatus === RequestStatus.SUCCESS && safeCode === '0x') {
    return <Navigate to={DEPLOY_SAFE} state={{ passkey }} />
  }

  return <p>You shouldn't have landed on this page, but somehow you did it! Here's an Easter egg for you: 🐣</p>
}

export { Home, loader }
