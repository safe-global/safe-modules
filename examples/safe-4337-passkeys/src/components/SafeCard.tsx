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
import { prepareUserOperationWithInitialisation } from '../logic/userOp'
import { useUserOpGasLimitEstimation } from '../hooks/useUserOpGasEstimation'
import { RequestStatus } from '../utils'

function SafeCard({ handleDeploySafeClick, passkey }: { passkey: PasskeyLocalStorageFormat; handleDeploySafeClick: () => void }) {
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

  const { userOpGasLimitEstimation, status: estimationStatus } = useUserOpGasLimitEstimation(unsignedUserOperation)

  return (
    <div className="card">
      <p>Predicted Safe Address: {unsignedUserOperation.sender}</p>

      {estimationStatus === RequestStatus.LOADING && <p>Estimating gas limit...</p>}
      {estimationStatus === RequestStatus.ERROR && <p>Failed to estimate gas limit</p>}
      {estimationStatus === RequestStatus.SUCCESS && <p>Estimated gas limit: {JSON.stringify(userOpGasLimitEstimation, null, 2)}</p>}

      <button onClick={handleDeploySafeClick}>Deploy Safe</button>
    </div>
  )
}

export { SafeCard }
