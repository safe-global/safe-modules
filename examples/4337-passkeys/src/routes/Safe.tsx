import { ethers, isAddress } from 'ethers'
import { LoaderFunction, Navigate, redirect, useParams } from 'react-router-dom'
import { RequestStatus } from '../utils'
import { useNativeTokenBalance } from '../hooks/useNativeTokenBalance'
import { useCodeAtAddress } from '../hooks/useCodeAtAddress'
import { getSafeWalletAppSafeDashboardLink } from '../logic/safeWalletApp.ts'
import { HOME_ROUTE } from './constants.ts'

import { useOutletContext } from '../hooks/UseOutletContext.tsx'

const loader: LoaderFunction = async ({ params }) => {
  const { safeAddress } = params

  if (!isAddress(safeAddress)) {
    return redirect(HOME_ROUTE)
  }

  return null
}

function Safe() {
  const { safeAddress } = useParams<{ safeAddress: string }>()
  const { walletProvider } = useOutletContext()
  const [safeCode, safeCodeStatus] = useCodeAtAddress(walletProvider, safeAddress || '')
  const [safeBalance, safeBalanceStatus] = useNativeTokenBalance(walletProvider, safeAddress || '')

  const notDeployed = safeCodeStatus === RequestStatus.SUCCESS && safeCode === '0x'
  if (notDeployed) {
    return <Navigate to={HOME_ROUTE} />
  }

  if (!safeAddress) {
    return null
  }

  return (
    <div className="card">
      <p>Safe Address: {safeAddress}</p>

      <p>
        Your Safe has been deployed. See it in the <a href={getSafeWalletAppSafeDashboardLink(safeAddress)}>{`Safe{Wallet} App`}</a>
      </p>

      <p>Balance: {safeBalanceStatus === RequestStatus.SUCCESS ? ethers.formatEther(safeBalance) : 'Loading...'}</p>
    </div>
  )
}

export { Safe, loader }
