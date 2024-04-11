import { useMemo, useState } from 'react'
import { LoaderFunction, Navigate, redirect, useLoaderData } from 'react-router-dom'
import { encodeSafeModuleSetupCall, getInitHash, getLaunchpadInitializer, getSafeAddress } from '../logic/safe'
import type { SafeInitializer } from '../logic/safe'
import {
  SAFE_4337_MODULE_ADDRESS,
  SAFE_MODULE_SETUP_ADDRESS,
  SAFE_PROXY_FACTORY_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  WEBAUTHN_SIGNER_FACTORY_ADDRESS,
  P256_VERIFIER_ADDRESS,
  APP_CHAIN_ID,
} from '../config'
import { getPasskeyFromLocalStorage, PasskeyLocalStorageFormat } from '../logic/passkeys'
import {
  UnsignedPackedUserOperation,
  getRequiredPrefund,
  packGasParameters,
  prepareUserOperationWithInitialisation,
  signAndSendUserOp,
} from '../logic/userOp'
import { useUserOpGasLimitEstimation } from '../hooks/useUserOpGasEstimation'
import { RequestStatus } from '../utils'
import { PrefundCard } from '../components/OpPrefundCard'
import { useFeeData } from '../hooks/useFeeData'
import { useNativeTokenBalance } from '../hooks/useNativeTokenBalance'
import { useCodeAtAddress } from '../hooks/useCodeAtAddress'
import { getSafeRoute, HOME_ROUTE } from './constants.ts'

import { useOutletContext } from '../hooks/UseOutletContext.tsx'

const loader: LoaderFunction = async () => {
  const passkey = getPasskeyFromLocalStorage()

  if (!passkey) {
    return redirect(HOME_ROUTE)
  }

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

  return { passkey, safeAddress }
}

function DeploySafe() {
  const { passkey, safeAddress } = useLoaderData() as { safeAddress: string; passkey: PasskeyLocalStorageFormat }
  const { walletProvider } = useOutletContext()
  const [safeCode, safeCodeStatus] = useCodeAtAddress(walletProvider, safeAddress)

  const initializer: SafeInitializer = useMemo(
    () => ({
      singleton: SAFE_SINGLETON_ADDRESS,
      fallbackHandler: SAFE_4337_MODULE_ADDRESS,
      signerFactory: WEBAUTHN_SIGNER_FACTORY_ADDRESS,
      signerX: passkey.pubkeyCoordinates.x,
      signerY: passkey.pubkeyCoordinates.y,
      signerVerifier: P256_VERIFIER_ADDRESS,
      setupTo: SAFE_MODULE_SETUP_ADDRESS,
      setupData: encodeSafeModuleSetupCall([SAFE_4337_MODULE_ADDRESS]),
    }),
    [passkey.pubkeyCoordinates.x, passkey.pubkeyCoordinates.y],
  )

  const unsignedUserOperation = useMemo(
    () => prepareUserOperationWithInitialisation(SAFE_PROXY_FACTORY_ADDRESS, initializer),
    [initializer],
  )

  const [feeData, feeDataStatus] = useFeeData(walletProvider)
  const { userOpGasLimitEstimation, status: estimationStatus } = useUserOpGasLimitEstimation(unsignedUserOperation)
  const gasParametersReady =
    feeDataStatus === RequestStatus.SUCCESS &&
    estimationStatus === RequestStatus.SUCCESS &&
    typeof userOpGasLimitEstimation !== 'undefined' &&
    feeData?.maxFeePerGas != null &&
    feeData?.maxPriorityFeePerGas != null

  const [safeBalance, safeBalanceStatus] = useNativeTokenBalance(walletProvider, unsignedUserOperation.sender)
  const [userOpHash, setUserOpHash] = useState<string>()

  const deployed = safeCodeStatus === RequestStatus.SUCCESS && safeCode !== '0x'
  const requiredPrefund = gasParametersReady ? getRequiredPrefund(feeData?.maxFeePerGas, userOpGasLimitEstimation) : 0n
  const needsPrefund = !deployed && safeBalanceStatus === RequestStatus.SUCCESS && safeBalance === 0n
  const readyToDeploy = !userOpHash && !deployed && gasParametersReady && !needsPrefund

  const gasParametersError = feeDataStatus === RequestStatus.ERROR || estimationStatus === RequestStatus.ERROR
  const gasParametersLoading = feeDataStatus === RequestStatus.LOADING || estimationStatus === RequestStatus.LOADING

  const handleDeploySafeClick = async () => {
    if (!gasParametersReady) return

    const userOpToSign: UnsignedPackedUserOperation = {
      ...unsignedUserOperation,
      ...packGasParameters({
        verificationGasLimit: userOpGasLimitEstimation.verificationGasLimit,
        callGasLimit: userOpGasLimitEstimation.callGasLimit,
        maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas,
        maxFeePerGas: feeData?.maxFeePerGas,
      }),
      preVerificationGas: userOpGasLimitEstimation.preVerificationGas,
    }

    const bundlerUserOpHash = await signAndSendUserOp(userOpToSign, passkey)
    setUserOpHash(bundlerUserOpHash)
  }

  if (deployed) {
    return <Navigate to={getSafeRoute(safeAddress)} />
  }

  return (
    <div className="card">
      <p>Safe Address: {unsignedUserOperation.sender}</p>

      {userOpHash && (
        <p>
          Your Safe is being deployed. Track the user operation on{' '}
          <a href={`https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia`}>jiffyscan</a>. Once deployed, the page will
          automatically redirect to the Safe dashboard.⏳
        </p>
      )}

      {needsPrefund ? (
        <>
          {gasParametersLoading && <p>Estimating gas parameters...</p>}
          {gasParametersError && <p>Failed to estimate gas limit</p>}
          {gasParametersReady && (
            <PrefundCard provider={walletProvider} safeAddress={unsignedUserOperation.sender} requiredPrefund={requiredPrefund} />
          )}
        </>
      ) : null}

      {readyToDeploy && <button onClick={handleDeploySafeClick}>Deploy Safe</button>}
    </div>
  )
}

export { DeploySafe, loader }
