import { ethers, isAddress } from 'ethers'
import { LoaderFunction, Navigate, redirect, useLoaderData, useParams } from 'react-router-dom'
import { RequestStatus } from '../utils'
import { useNativeTokenBalance } from '../hooks/useNativeTokenBalance'
import { useCodeAtAddress } from '../hooks/useCodeAtAddress'
import { getSafeWalletAppSafeDashboardLink } from '../logic/safeWalletApp.ts'
import { HOME_ROUTE } from './constants.ts'
import { useOutletContext } from '../hooks/UseOutletContext.tsx'
import { SendNativeToken } from '../components/SendNativeToken.tsx'
import { useEntryPointAccountNonce } from '../hooks/useEntryPointAccountNonce.ts'
import { useEntryPointAccountBalance } from '../hooks/useEntryPointAccountBalance.ts'
import { signAndSendUserOp, UnsignedPackedUserOperation } from '../logic/userOp.ts'
import { getPasskeyFromLocalStorage, PasskeyLocalStorageFormat } from '../logic/passkeys.ts'

const loader: LoaderFunction = async ({ params }) => {
  const { safeAddress } = params
  const passkey = getPasskeyFromLocalStorage()

  if (!isAddress(safeAddress) || !passkey) {
    return redirect(HOME_ROUTE)
  }

  return { passkey }
}

function Safe() {
  const { safeAddress } = useParams<{ safeAddress: string }>()
  const { walletProvider } = useOutletContext()
  const { passkey } = useLoaderData() as { passkey: PasskeyLocalStorageFormat }
  const [safeCode, safeCodeStatus] = useCodeAtAddress(walletProvider, safeAddress || '')
  const [safeBalance, safeBalanceStatus] = useNativeTokenBalance(walletProvider, safeAddress || '')
  const [safeNonce, safeNonceStatus] = useEntryPointAccountNonce(walletProvider, safeAddress || '')
  const [safeEntryPointBalance, safeEntryPointBalanceStatus] = useEntryPointAccountBalance(walletProvider, safeAddress || '')

  const handleSendFunds = async (userOp: UnsignedPackedUserOperation) => {
    const userOpHash = signAndSendUserOp(userOp, passkey)

    return userOpHash
  }

  const notDeployed = safeCodeStatus === RequestStatus.SUCCESS && safeCode === '0x'
  if (notDeployed) {
    return <Navigate to={HOME_ROUTE} />
  }

  if (!safeAddress) {
    return null
  }

  if (
    safeCodeStatus === RequestStatus.ERROR ||
    safeBalanceStatus === RequestStatus.ERROR ||
    safeNonceStatus === RequestStatus.ERROR ||
    safeEntryPointBalanceStatus === RequestStatus.ERROR
  ) {
    return <div>Error loading Safe data. Please refresh the page.</div>
  }

  if (safeNonce === null || safeEntryPointBalance === null) {
    return <div>Loading...</div>
  }

  return (
    <div className="card">
      <p>
        Safe Address: <a href={getSafeWalletAppSafeDashboardLink(safeAddress)}>{safeAddress}</a>
      </p>

      <p>Balance: {safeBalanceStatus === RequestStatus.SUCCESS ? ethers.formatEther(safeBalance) : 'Loading...'}</p>

      <p>
        EntryPoint Balance:{' '}
        {safeEntryPointBalanceStatus === RequestStatus.SUCCESS ? ethers.formatEther(safeEntryPointBalance) : 'Loading...'}
      </p>

      <SendNativeToken
        balanceWei={safeBalance}
        onSend={handleSendFunds}
        walletProvider={walletProvider}
        nonce={safeNonce}
        accountEntryPointBalance={safeEntryPointBalance}
        safeAddress={safeAddress}
      />
    </div>
  )
}

export { Safe, loader }
