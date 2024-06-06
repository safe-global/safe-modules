import { FormEventHandler, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { useFeeData } from '../hooks/useFeeData.ts'
import { getMissingAccountFunds, getUnsignedUserOperation, packGasParameters, UnsignedPackedUserOperation } from '../logic/userOp.ts'
import { useUserOpGasLimitEstimation } from '../hooks/useUserOpGasEstimation.ts'
import { RequestStatus } from '../utils.ts'
import { MissingAccountFundsCard } from './MissingAccountFundsCard.tsx'

type Props = {
  balanceWei: bigint
  onSend: (userOp: UnsignedPackedUserOperation) => Promise<string>
  walletProvider: ethers.Eip1193Provider
  safeAddress: string
  nonce: bigint
  accountEntryPointBalance: bigint
}

function SendNativeToken({ balanceWei, onSend, walletProvider, safeAddress, nonce, accountEntryPointBalance }: Props) {
  const [amount, setAmount] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const [feeData, feeDataStatus] = useFeeData(walletProvider)
  const [userOpHash, setUserOpHash] = useState<string | null>(null)

  const userOp = useMemo(
    () =>
      getUnsignedUserOperation(
        {
          to: to === '' ? `0x${'beef'.repeat(10)}` : to,
          value: amount === '' ? '0x0' : ethers.parseEther(amount),
          data: '0x',
          operation: 0,
        },
        safeAddress,
        nonce,
      ),
    [safeAddress, nonce, to, amount],
  )

  const { userOpGasLimitEstimation, status: estimationStatus } = useUserOpGasLimitEstimation(userOp)

  const gasParametersReady =
    feeDataStatus === RequestStatus.SUCCESS &&
    estimationStatus === RequestStatus.SUCCESS &&
    typeof userOpGasLimitEstimation !== 'undefined' &&
    feeData?.maxFeePerGas != null &&
    feeData?.maxPriorityFeePerGas != null

  const userOperationFee = useMemo(() => {
    if (!gasParametersReady) {
      return 0n
    }

    // @ts-expect-error it is handled in the if statement above
    return getMissingAccountFunds(feeData!.maxFeePerGas, userOpGasLimitEstimation!, 0n)
  }, [feeData, gasParametersReady, userOpGasLimitEstimation])
  const missingAccountFundsForEntrypoint =
    userOperationFee - accountEntryPointBalance > 0 ? userOperationFee - accountEntryPointBalance : 0n
  const missingAccountFundsFromTheBalance = balanceWei - missingAccountFundsForEntrypoint
  const maxAmount = missingAccountFundsFromTheBalance >= 0n ? ethers.formatEther(balanceWei - missingAccountFundsForEntrypoint) : '0'

  const send: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    setError('')
    setUserOpHash(null)

    if (!ethers.isAddress(to)) {
      setError('Invalid address')
      return
    }

    if (amount === null || ethers.parseEther(amount) > balanceWei || missingAccountFundsFromTheBalance < 0n) {
      setError('Invalid amount')
      return
    }

    if (!gasParametersReady) return

    const userOpToSign: UnsignedPackedUserOperation = {
      ...userOp,
      ...packGasParameters({
        verificationGasLimit: userOpGasLimitEstimation.verificationGasLimit,
        callGasLimit: userOpGasLimitEstimation.callGasLimit,
        maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas,
        maxFeePerGas: feeData?.maxFeePerGas,
      }),
      preVerificationGas: userOpGasLimitEstimation.preVerificationGas,
    }
    try {
      const userOpHash = await onSend(userOpToSign)
      setUserOpHash(userOpHash)
    } catch (e) {
      console.error(e)
      setError('Error sending transaction')
    }
  }

  return (
    <form
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
      onSubmit={send}
    >
      <h2>Send Native Token</h2>
      <label>
        To:
        <input required type="text" name="to" value={to} onChange={(e) => setTo(e.target.value)} style={{ display: 'block' }} />
      </label>
      <label>
        Amount (ETH):
        <input
          required
          type="number"
          name="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ display: 'block' }}
        />
        <button
          type="button"
          style={{
            padding: 0,
            background: 'transparent',
            fontSize: '0.8rem',
          }}
          onClick={() => setAmount(maxAmount)}
        >
          Max
        </button>
      </label>
      <p>Approx. fee: {ethers.formatEther(userOperationFee)} ETH</p>
      {missingAccountFundsFromTheBalance < 0n && (
        <MissingAccountFundsCard
          provider={walletProvider}
          missingAccountFunds={-missingAccountFundsFromTheBalance}
          safeAddress={safeAddress}
        />
      )}
      <button
        type="submit"
        style={{
          width: '100px',
        }}
        disabled={missingAccountFundsFromTheBalance < 0n}
      >
        Send
      </button>
      {error && <p>{error}</p>}
      {userOpHash && (
        <p>
          Your transaction is confirming. Track it on{' '}
          <a href={`https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia`}>jiffyscan</a>. ⏳
        </p>
      )}
    </form>
  )
}

export { SendNativeToken }
