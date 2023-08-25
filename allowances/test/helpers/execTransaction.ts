import { BigNumber, Contract, PopulatedTransaction } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

export default async function execTransaction(
  safe: Contract,
  { to, value = BigNumber.from(0), data }: PopulatedTransaction,
  owner: SignerWithAddress
) {
  const nonce = await safe.nonce()

  const { domain, types, message } = paramsToSign(
    safe.address,
    await owner.getChainId(),
    { to, value, data },
    nonce
  )

  const signature = await owner._signTypedData(domain, types, message)

  await owner.sendTransaction({
    to: safe.address,
    data: safe.interface.encodeFunctionData('execTransaction', [
      to,
      value,
      data,
      0, // operation
      0,
      0,
      0,
      AddressZero,
      AddressZero,
      signature,
    ]),
    value: 0,
  })
}

function paramsToSign(
  safeAddress: string,
  chainId: number,
  { to, value, data }: PopulatedTransaction,
  nonce: bigint | number
) {
  const domain = { verifyingContract: safeAddress, chainId }
  const primaryType = 'SafeTx' as const
  const types = {
    SafeTx: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'value' },
      { type: 'bytes', name: 'data' },
      { type: 'uint8', name: 'operation' },
      { type: 'uint256', name: 'safeTxGas' },
      { type: 'uint256', name: 'baseGas' },
      { type: 'uint256', name: 'gasPrice' },
      { type: 'address', name: 'gasToken' },
      { type: 'address', name: 'refundReceiver' },
      { type: 'uint256', name: 'nonce' },
    ],
  }
  const message = {
    to,
    value,
    data,
    operation: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: AddressZero,
    refundReceiver: AddressZero,
    nonce,
  }

  return { domain, primaryType, types, message }
}

const AddressZero = '0x'.padEnd(42, '0')
const Bytes32Zero = '0x'.padEnd(66, '0')
