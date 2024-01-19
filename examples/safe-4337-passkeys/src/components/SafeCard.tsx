import { useMemo } from 'react'
import { ethers } from 'ethers'
import { encodeAddModuleLibCall } from '../logic/safe'
import type { SafeInitializer } from '../logic/safe'
import {
  ADD_MODULES_LIB_ADDRESS,
  SAFE_4337_MODULE_ADDRESS,
  SAFE_PROXY_FACTORY_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  WEBAUTHN_SIGNER_FACTORY_ADDRESS,
} from '../config'
import { PasskeyLocalStorageFormat } from '../logic/passkeys'
import { UnsignedUserOperation, getRequiredPrefund, prepareUserOperationWithInitialisation, signAndSendUserOp } from '../logic/userOp'
import { useUserOpGasLimitEstimation } from '../hooks/useUserOpGasEstimation'
import { RequestStatus } from '../utils'
import { PrefundCard } from './OpPrefundCard'
import { useFeeData } from '../hooks/useFeeData'
import { useNativeTokenBalance } from '../hooks/useNativeTokenBalance'

function SafeCard({ passkey, provider }: { passkey: PasskeyLocalStorageFormat; provider: ethers.Eip1193Provider }) {
  const initializer: SafeInitializer = useMemo(
    () => ({
      singleton: SAFE_SINGLETON_ADDRESS,
      fallbackHandler: SAFE_4337_MODULE_ADDRESS,
      signerFactory: WEBAUTHN_SIGNER_FACTORY_ADDRESS,
      signerData: ethers.solidityPacked(['uint256', 'uint256'], [passkey.pubkeyCoordinates.x, passkey.pubkeyCoordinates.y]),
      setupTo: ADD_MODULES_LIB_ADDRESS,
      setupData: encodeAddModuleLibCall([SAFE_4337_MODULE_ADDRESS]),
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
  const requiredPrefund = gasParametersReady ? getRequiredPrefund(feeData?.maxFeePerGas, userOpGasLimitEstimation) : 0n
  const needsPrefund = safeBalanceStatus === RequestStatus.SUCCESS && safeBalance < requiredPrefund
  const readyToDeploy = gasParametersReady && !needsPrefund

  const gasParametersError = feeDataStatus === RequestStatus.ERROR || estimationStatus === RequestStatus.ERROR
  const gasParametersLoading = feeDataStatus === RequestStatus.LOADING || estimationStatus === RequestStatus.LOADING

  const handleDeploySafeClick = async () => {
    if (!gasParametersReady) return

    const userOpToSign: UnsignedUserOperation = {
      ...unsignedUserOperation,
      verificationGasLimit: userOpGasLimitEstimation.verificationGasLimit,
      preVerificationGas: userOpGasLimitEstimation.preVerificationGas,
      callGasLimit: userOpGasLimitEstimation.callGasLimit,
      maxFeePerGas: '0x' + feeData?.maxFeePerGas.toString(16),
      maxPriorityFeePerGas: '0x' + feeData?.maxPriorityFeePerGas.toString(16),
    }

    await signAndSendUserOp(userOpToSign, passkey)
  }

  return (
    <div className="card">
      <p>Predicted Safe Address: {unsignedUserOperation.sender}</p>

      {gasParametersLoading && <p>Estimating gas parameters...</p>}
      {gasParametersError && <p>Failed to estimate gas limit</p>}
      {gasParametersReady && needsPrefund && (
        <PrefundCard provider={provider} safeAddress={unsignedUserOperation.sender} requiredPrefund={requiredPrefund} />
      )}

      {readyToDeploy && <button onClick={handleDeploySafeClick}>Deploy Safe</button>}
    </div>
  )
}

export { SafeCard }
