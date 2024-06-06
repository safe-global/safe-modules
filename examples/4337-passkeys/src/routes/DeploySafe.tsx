import { useMemo, useState } from 'react'
import { Navigate, redirect, useLoaderData } from 'react-router-dom'
import { useWeb3ModalAccount } from '@web3modal/ethers/react'
import {
  encodeSetupCall,
  getSafeAddress,
  getSafeAddressFromLocalStorage,
  getSafeDeploymentData,
  getSafeInitializer,
  storeSafeAddressInLocalStorage,
} from '../logic/safe'
import {
  SAFE_4337_MODULE_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  SAFE_PROXY_FACTORY_ADDRESS,
  P256_VERIFIER_ADDRESS,
  SAFE_MULTISEND_ADDRESS,
  SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS,
  XANDER_BLAZE_NFT_ADDRESS,
} from '../config'
import { getPasskeyFromLocalStorage, PasskeyLocalStorageFormat } from '../logic/passkeys'
import {
  UnsignedPackedUserOperation,
  getMissingAccountFunds,
  getUnsignedUserOperation,
  getUserOpInitCode,
  packGasParameters,
  signAndSendUserOp,
} from '../logic/userOp'
import { useUserOpGasLimitEstimation } from '../hooks/useUserOpGasEstimation'
import { RequestStatus } from '../utils'
import { MissingAccountFundsCard } from '../components/MissingAccountFundsCard.tsx'
import { useFeeData } from '../hooks/useFeeData'
import { useNativeTokenBalance } from '../hooks/useNativeTokenBalance'
import { useCodeAtAddress } from '../hooks/useCodeAtAddress'
import { getSafeRoute, HOME_ROUTE } from './constants.ts'

import { useOutletContext } from '../hooks/UseOutletContext.tsx'
import { encodeSafeMintData } from '../logic/erc721.ts'

type LoaderData = {
  passkey: PasskeyLocalStorageFormat
  safeAddressFromStorage: string | null
}

async function loader(): Promise<Response | LoaderData> {
  const passkey = getPasskeyFromLocalStorage()
  if (!passkey) {
    return redirect(HOME_ROUTE)
  }

  const safeAddressFromStorage = getSafeAddressFromLocalStorage()
  return { passkey, safeAddressFromStorage }
}

function DeploySafe() {
  const { passkey, safeAddressFromStorage } = useLoaderData() as LoaderData
  const { address } = useWeb3ModalAccount()
  const setupData = useMemo(
    () => encodeSetupCall([SAFE_4337_MODULE_ADDRESS], { ...passkey.pubkeyCoordinates, verifiers: P256_VERIFIER_ADDRESS }),
    [passkey],
  )
  const initializer = useMemo(() => {
    const owners = [SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS]
    if (address) owners.push(address)

    return getSafeInitializer(owners, 1, SAFE_4337_MODULE_ADDRESS, SAFE_MULTISEND_ADDRESS, setupData)
  }, [setupData, address])
  const safeAddress = useMemo(() => safeAddressFromStorage || getSafeAddress(initializer), [initializer, safeAddressFromStorage])

  const { walletProvider } = useOutletContext()
  const [safeCode, safeCodeStatus] = useCodeAtAddress(walletProvider, safeAddress)
  const callData = useMemo(() => encodeSafeMintData(safeAddress), [safeAddress])
  const initCode = useMemo(
    () => getUserOpInitCode(SAFE_PROXY_FACTORY_ADDRESS, getSafeDeploymentData(SAFE_SINGLETON_ADDRESS, initializer)),
    [initializer],
  )

  const unsignedUserOperation = useMemo(
    () =>
      getUnsignedUserOperation(
        {
          to: XANDER_BLAZE_NFT_ADDRESS,
          data: callData,
          value: 0,
          operation: 0,
        },
        safeAddress,
        0,
        initCode,
      ),
    [callData, safeAddress, initCode],
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
  const missingFunds = gasParametersReady ? getMissingAccountFunds(feeData?.maxFeePerGas, userOpGasLimitEstimation) : 0n
  const isMissingFunds = !deployed && safeBalanceStatus === RequestStatus.SUCCESS && safeBalance === 0n
  const readyToDeploy = !userOpHash && !deployed && gasParametersReady && !isMissingFunds

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

    storeSafeAddressInLocalStorage(safeAddress)
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

      {isMissingFunds ? (
        <>
          {gasParametersLoading && <p>Estimating gas parameters...</p>}
          {gasParametersError && <p>Failed to estimate gas limit</p>}
          {gasParametersReady && (
            <MissingAccountFundsCard
              provider={walletProvider}
              safeAddress={unsignedUserOperation.sender}
              missingAccountFunds={missingFunds}
            />
          )}
        </>
      ) : null}

      {readyToDeploy && <button onClick={handleDeploySafeClick}>Deploy Safe</button>}
    </div>
  )
}

export { DeploySafe, loader }
