import dotenv from 'dotenv'
import {
  parseEther,
  type Hex,
  type PrivateKeyAccount,
  type Address,
  type Chain,
  type PublicClient,
  type Transport,
  formatEther,
  concat,
  pad,
  toHex,
} from 'viem'
import { encodeCallData } from './safe'
import { EIP712_SAFE_OPERATION_TYPE } from './type'
import { setTimeout } from 'timers/promises'
import { generateTransferCallData, getERC20Balance, getERC20Decimals, mintERC20Token } from './erc20'
import { generateMintingCallData } from './erc721'
import { transferETH } from './nativeTransfer'

dotenv.config()

export const txTypes = ['account', 'erc20', 'erc721', 'native-transfer']

export type UserOperation = {
  sender: Address
  nonce: bigint
  factory?: Address
  factoryData?: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymaster?: Address
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
  paymasterData?: Hex
  signature: Hex
  initCode?: never
  paymasterAndData?: never
}

export type PackedUserOperation = {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: bigint
  gasFees: Hex
  paymasterAndData: Hex
  signature: Hex
}

export type UserOperationReceipt = {
  actualGasUsed: bigint
  receipt: {
    transactionHash: Address
    gasUsed: bigint
  }
}

export interface BundlerClient {
  sendUserOperation: (args: { userOperation: UserOperation; entryPoint: Address }) => Promise<Address>
  getUserOperationReceipt: (args: { hash: Address }) => Promise<UserOperationReceipt | null>
}

export const submitUserOperationPimlico = async (
  userOperation: UserOperation,
  bundlerClient: BundlerClient,
  entryPointAddress: Address,
  chain: string,
) => {
  const userOperationHash = await bundlerClient.sendUserOperation({
    userOperation,
    entryPoint: entryPointAddress,
  })
  console.log(`UserOperation submitted. Hash: ${userOperationHash}`)
  console.log(`UserOp Link: https://jiffyscan.xyz/userOpHash/${userOperationHash}?network=` + chain + '\n')

  console.log('Querying for receipts...')
  let receipt = await bundlerClient.getUserOperationReceipt({
    hash: userOperationHash,
  })
  while (receipt == null) {
    await setTimeout(10000) // Sometimes it takes time to index.
    receipt = await bundlerClient.getUserOperationReceipt({
      hash: userOperationHash,
    })
  }
  console.log(`Receipt found!\nTransaction hash: ${receipt.receipt.transactionHash}`)
  if (chain == 'base-sepolia') {
    console.log(`Transaction Link: https://sepolia.basescan.org/tx/${receipt.receipt.transactionHash}`)
  } else {
    console.log(`Transaction Link: https://${chain}.etherscan.io/tx/${receipt.receipt.transactionHash}`)
  }
  console.log(`\nGas Used (Account or Paymaster): ${receipt.actualGasUsed}`)
  console.log(`Gas Used (Transaction): ${receipt.receipt.gasUsed}\n`)
}

export const signUserOperation = async (
  userOperation: UserOperation,
  signer: PrivateKeyAccount,
  chainID: number,
  entryPointAddress: `0x${string}`,
  safe4337ModuleAddress: `0x${string}`,
) => {
  const signatures = [
    {
      signer: signer.address,
      data: await signer.signTypedData({
        domain: {
          chainId: chainID,
          verifyingContract: safe4337ModuleAddress,
        },
        types: EIP712_SAFE_OPERATION_TYPE,
        primaryType: 'SafeOp',
        message: {
          safe: userOperation.sender,
          nonce: userOperation.nonce,
          initCode: getInitCode(userOperation),
          callData: userOperation.callData,
          verificationGasLimit: userOperation.verificationGasLimit,
          callGasLimit: userOperation.callGasLimit,
          preVerificationGas: userOperation.preVerificationGas,
          maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
          maxFeePerGas: userOperation.maxFeePerGas,
          paymasterAndData: getPaymasterAndData(userOperation),
          validAfter: '0x000000000000',
          validUntil: '0x000000000000',
          entryPoint: entryPointAddress,
        },
      }),
    },
  ]

  signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()))

  let signatureBytes: Address = '0x000000000000000000000000'
  for (const sig of signatures) {
    signatureBytes += sig.data.slice(2)
  }

  return signatureBytes
}

export const createCallData = async <C extends Chain>(
  chain: string,
  publicClient: PublicClient<Transport<'http'>, C>,
  signer: PrivateKeyAccount,
  txType: string,
  senderAddress: `0x${string}`,
  erc20TokenAddress: `0x${string}`,
  erc721TokenAddress: `0x${string}`,
  paymaster: string,
) => {
  let txCallData!: `0x${string}`
  if (txType == 'account') {
    txCallData = encodeCallData({
      to: senderAddress,
      data: '0x',
      value: 0n,
    })
  } else if (txType == 'erc20') {
    // Token Configurations
    const erc20Decimals = await getERC20Decimals(erc20TokenAddress, publicClient)
    const erc20Amount = 10n ** BigInt(erc20Decimals)
    let senderERC20Balance = await getERC20Balance(erc20TokenAddress, publicClient, senderAddress)
    console.log('\nSafe Wallet ERC20 Balance:', Number(senderERC20Balance / erc20Amount))

    // Trying to mint tokens (Make sure ERC20 Token Contract is mintable by anyone).
    if (senderERC20Balance < erc20Amount) {
      console.log('\nMinting ERC20 Tokens to Safe Wallet.')
      await mintERC20Token(erc20TokenAddress, publicClient, signer, senderAddress, erc20Amount, paymaster)

      while (senderERC20Balance < erc20Amount) {
        await setTimeout(15000)
        senderERC20Balance = await getERC20Balance(erc20TokenAddress, publicClient, senderAddress)
      }
      console.log('\nUpdated Safe Wallet ERC20 Balance:', Number(senderERC20Balance / erc20Amount))
    }

    txCallData = encodeCallData({
      to: erc20TokenAddress,
      data: generateTransferCallData(signer.address, erc20Amount), // transfer() function call with corresponding data.
      value: 0n,
    })
  } else if (txType == 'erc721') {
    txCallData = encodeCallData({
      to: erc721TokenAddress,
      data: generateMintingCallData(signer.address), // safeMint() function call with corresponding data.
      value: 0n,
    })
  } else if (txType == 'native-transfer') {
    const weiToSend = parseEther('0.000001')
    let safeETHBalance = await publicClient.getBalance({
      address: senderAddress,
    })
    if (safeETHBalance < weiToSend) {
      console.log('\nTransferring', formatEther(weiToSend - safeETHBalance), 'ETH to Safe for native transfer.')
      await transferETH(publicClient, signer, senderAddress, weiToSend - safeETHBalance, chain, paymaster)
      while (safeETHBalance < weiToSend) {
        await setTimeout(30000) // Sometimes it takes time to index.
        safeETHBalance = await publicClient.getBalance({
          address: senderAddress,
        })
      }
      console.log('\nTransferred required ETH for the native transfer.')
    }

    txCallData = encodeCallData({
      to: signer.address,
      data: '0x',
      value: weiToSend,
    })
  }

  console.log('\nAppropriate calldata created.')
  return txCallData
}

export function getInitCode(unpackedUserOperation: UserOperation) {
  return unpackedUserOperation.factory ? concat([unpackedUserOperation.factory, unpackedUserOperation.factoryData || ('0x' as Hex)]) : '0x'
}

export function getAccountGasLimits(unpackedUserOperation: UserOperation) {
  return concat([
    pad(toHex(unpackedUserOperation.verificationGasLimit), {
      size: 16,
    }),
    pad(toHex(unpackedUserOperation.callGasLimit), { size: 16 }),
  ])
}

export function getGasLimits(unpackedUserOperation: UserOperation) {
  return concat([
    pad(toHex(unpackedUserOperation.maxPriorityFeePerGas), {
      size: 16,
    }),
    pad(toHex(unpackedUserOperation.maxFeePerGas), { size: 16 }),
  ])
}

export function getPaymasterAndData(unpackedUserOperation: UserOperation) {
  return unpackedUserOperation.paymaster
    ? concat([
        unpackedUserOperation.paymaster,
        pad(toHex(unpackedUserOperation.paymasterVerificationGasLimit || 0n), {
          size: 16,
        }),
        pad(toHex(unpackedUserOperation.paymasterPostOpGasLimit || 0n), {
          size: 16,
        }),
        unpackedUserOperation.paymasterData || ('0x' as Hex),
      ])
    : '0x'
}

export function toPackedUserOperation(unpackedUserOperation: UserOperation): PackedUserOperation {
  return {
    sender: unpackedUserOperation.sender,
    nonce: unpackedUserOperation.nonce,
    initCode: getInitCode(unpackedUserOperation),
    callData: unpackedUserOperation.callData,
    accountGasLimits: getAccountGasLimits(unpackedUserOperation),
    preVerificationGas: unpackedUserOperation.preVerificationGas,
    gasFees: getGasLimits(unpackedUserOperation),
    paymasterAndData: getPaymasterAndData(unpackedUserOperation),
    signature: unpackedUserOperation.signature,
  }
}
