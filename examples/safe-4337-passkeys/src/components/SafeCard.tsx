import { useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { encodeSafeModuleSetupCall } from '../logic/safe'
import type { SafeInitializer } from '../logic/safe'
import {
  SAFE_4337_MODULE_ADDRESS,
  SAFE_MODULE_SETUP_ADDRESS,
  SAFE_PROXY_FACTORY_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  WEBAUTHN_SIGNER_FACTORY_ADDRESS,
  WEBAUTHN_VERIFIER_ADDRESS,
} from '../config'
import { PasskeyLocalStorageFormat } from '../logic/passkeys'
import {
  UnsignedPackedUserOperation,
  getRequiredPrefund,
  packGasParameters,
  prepareUserOperationWithInitialisation,
  signAndSendUserOp,
} from '../logic/userOp'
import { useUserOpGasLimitEstimation } from '../hooks/useUserOpGasEstimation'
import { RequestStatus } from '../utils'
import { PrefundCard } from './OpPrefundCard'
import { useFeeData } from '../hooks/useFeeData'
import { useNativeTokenBalance } from '../hooks/useNativeTokenBalance'
import { useCodeAtAddress } from '../hooks/useCodeAtAddress'

function SafeCard({ passkey, provider }: { passkey: PasskeyLocalStorageFormat; provider: ethers.Eip1193Provider }) {
  const initializer: SafeInitializer = useMemo(
    () => ({
      singleton: SAFE_SINGLETON_ADDRESS,
      fallbackHandler: SAFE_4337_MODULE_ADDRESS,
      signerFactory: WEBAUTHN_SIGNER_FACTORY_ADDRESS,
      signerData: ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'address'],
        [passkey.pubkeyCoordinates.x, passkey.pubkeyCoordinates.y, WEBAUTHN_VERIFIER_ADDRESS],
      ),
      setupTo: SAFE_MODULE_SETUP_ADDRESS,
      setupData: encodeSafeModuleSetupCall([SAFE_4337_MODULE_ADDRESS]),
    }),
    [passkey.pubkeyCoordinates.x, passkey.pubkeyCoordinates.y],
  )

  const unsignedUserOperation = useMemo(
    () => prepareUserOperationWithInitialisation(SAFE_PROXY_FACTORY_ADDRESS, initializer),
    [initializer],
  )

  const [feeData, feeDataStatus] = useFeeData(provider)
  const { userOpGasLimitEstimation, status: estimationStatus } = useUserOpGasLimitEstimation(unsignedUserOperation)
  const gasParametersReady =
    feeDataStatus === RequestStatus.SUCCESS &&
    estimationStatus === RequestStatus.SUCCESS &&
    typeof userOpGasLimitEstimation !== 'undefined' &&
    feeData?.maxFeePerGas != null &&
    feeData?.maxPriorityFeePerGas != null

  const [safeBalance, safeBalanceStatus] = useNativeTokenBalance(provider, unsignedUserOperation.sender)
  const [safeCode, safeCodeStatus] = useCodeAtAddress(provider, unsignedUserOperation.sender)
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

  return (
    <div className="card">
      <p>Counterfactual Safe Address: {unsignedUserOperation.sender}</p>

      {userOpHash && (
        <p>
          Your Safe is being deployed. Track the user operation on{' '}
          <a href={`https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia`}>jiffyscan</a>
        </p>
      )}

      {deployed && (
        <p>
          Your Safe has been deployed. More info on{' '}
          <a href={`https://jiffyscan.xyz/account/${unsignedUserOperation.sender}?network=sepolia`}>jiffyscan</a>
        </p>
      )}

      {needsPrefund ? (
        <>
          {gasParametersLoading && <p>Estimating gas parameters...</p>}
          {gasParametersError && <p>Failed to estimate gas limit</p>}
          {gasParametersReady && (
            <PrefundCard provider={provider} safeAddress={unsignedUserOperation.sender} requiredPrefund={requiredPrefund} />
          )}
        </>
      ) : null}

      {readyToDeploy && <button onClick={handleDeploySafeClick}>Deploy Safe</button>}
    </div>
  )
}

export { SafeCard }
