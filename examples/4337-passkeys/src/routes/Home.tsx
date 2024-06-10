import { Navigate, redirect, useLoaderData } from 'react-router-dom'
import { getPasskeyFromLocalStorage, PasskeyLocalStorageFormat } from '../logic/passkeys.ts'
import { getSafeAddressFromLocalStorage } from '../logic/safe.ts'
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

  const safeAddress = getSafeAddressFromLocalStorage()
  if (!safeAddress) {
    return redirect(DEPLOY_SAFE_ROUTE)
  }

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
