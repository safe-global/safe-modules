import dotenv from 'dotenv'
import { fromHex, parseEther, type Hex, type PrivateKeyAccount, type Address, formatEther, concat, pad, toHex, hashTypedData } from 'viem'
import { encodeCallData } from './safe'
import { EIP712_SAFE_OPERATION_TYPE } from './type'
import { Alchemy } from 'alchemy-sdk'
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

// Sponsored User Operation Data
export type suoData = {
  preVerificationGas: any
  callGasLimit: any
  verificationGasLimit: any
  paymasterAndData: any
  maxFeePerGas: any
  maxPriorityFeePerGas: any
}

export type gasData = {
  preVerificationGas: any
  callGasLimit: any
  verificationGasLimit: any
}

export const submitUserOperationPimlico = async (
  userOperation: UserOperation,
  bundlerClient: any,
  entryPointAddress: string,
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

export const getGasValuesFromAlchemyPaymaster = async (
  policyID: string | undefined,
  entryPointAddress: `0x${string}`,
  sponsoredUserOperation: UserOperation,
  chain: string,
  apiKey: string,
) => {
  const gasOptions = {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_requestGasAndPaymasterAndData',
      params: [
        {
          policyId: policyID,
          entryPoint: entryPointAddress,
          dummySignature: sponsoredUserOperation.signature,
          userOperation: {
            sender: sponsoredUserOperation.sender,
            nonce: '0x' + sponsoredUserOperation.nonce.toString(16),
            initCode: sponsoredUserOperation.initCode,
            callData: sponsoredUserOperation.callData,
          },
        },
      ],
    }),
  }

  let rv
  let responseValues
  await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, gasOptions)
    .then((response) => response.json())
    .then((response) => (responseValues = response))
    .catch((err) => console.error(err))
  console.log('\nReceived Paymaster Data from Alchemy.')

  if (responseValues && responseValues['result']) {
    rv = responseValues['result'] as suoData
  }
  return rv
}

export const getFeeValuesFromAlchemy = async (chain: string, apiKey: string) => {
  const feeOptions = {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'rundler_maxPriorityFeePerGas',
    }),
  }

  let responseValues
  await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, feeOptions)
    .then((response) => response.json())
    .then((response) => (responseValues = response))
    .catch((err) => console.error(err))
  console.log('\nReceived Fee Data from Alchemy.')

  let rvFee
  if (responseValues && responseValues['result']) {
    rvFee = responseValues['result'] as bigint
  }
  return rvFee as bigint
}

export const getMaxFeePerGas = async (alchemy: Alchemy, maxPriorityFeePerGas: bigint) => {
  let maxFeePerGas

  // Get the latest Block Number
  const latestBlockNum = await alchemy.core.getBlockNumber()

  // Get latest Block Details
  const rvBlock = await alchemy.core.getBlock(latestBlockNum)
  if (rvBlock && rvBlock.baseFeePerGas) {
    maxFeePerGas = ((BigInt(rvBlock.baseFeePerGas._hex) + BigInt(maxPriorityFeePerGas)) * 15n) / 10n // Adding a buffer. Recommended is atleast 50%.
    // https://docs.alchemy.com/reference/bundler-api-fee-logic
  }

  return ('0x' + maxFeePerGas?.toString(16)) as any
}

export const getGasValuesFromAlchemy = async (
  entryPointAddress: `0x${string}`,
  sponsoredUserOperation: UserOperation,
  chain: string,
  apiKey: string,
) => {
  const gasOptions = {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_estimateUserOperationGas',
      params: [
        {
          sender: sponsoredUserOperation.sender,
          nonce: '0x' + sponsoredUserOperation.nonce.toString(16),
          initCode: sponsoredUserOperation.initCode,
          callData: sponsoredUserOperation.callData,
          callGasLimit: '0x1',
          verificationGasLimit: '0x1',
          preVerificationGas: '0x1',
          maxFeePerGas: sponsoredUserOperation.maxFeePerGas.toString(16),
          maxPriorityFeePerGas: sponsoredUserOperation.maxPriorityFeePerGas.toString(16),
          signature: sponsoredUserOperation.signature,
          paymasterAndData: '0x',
        },
        entryPointAddress,
      ],
    }),
  }

  let responseValues
  await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, gasOptions)
    .then((response) => response.json())
    .then((response) => (responseValues = response))
    .catch((err) => console.error(err))
  console.log('\nReceived Gas Data from Alchemy.')

  let rvGas
  if (responseValues && responseValues['result']) {
    rvGas = responseValues['result'] as gasData
  }

  return rvGas
}

export const submitUserOperationAlchemy = async (
  entryPointAddress: `0x${string}`,
  sponsoredUserOperation: UserOperation,
  chain: string,
  apiKey: string,
) => {
  const options = {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_sendUserOperation',
      params: [
        {
          sender: sponsoredUserOperation.sender,
          nonce: '0x' + sponsoredUserOperation.nonce.toString(16),
          initCode: sponsoredUserOperation.initCode,
          callData: sponsoredUserOperation.callData,
          callGasLimit: sponsoredUserOperation.callGasLimit.toString(16),
          verificationGasLimit: sponsoredUserOperation.verificationGasLimit.toString(16),
          preVerificationGas: sponsoredUserOperation.preVerificationGas.toString(16),
          maxFeePerGas: sponsoredUserOperation.maxFeePerGas.toString(16),
          maxPriorityFeePerGas: sponsoredUserOperation.maxPriorityFeePerGas.toString(16),
          signature: sponsoredUserOperation.signature,
          paymasterAndData: sponsoredUserOperation.paymasterAndData,
        },
        entryPointAddress,
      ],
    }),
  }

  let responseValues
  await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, options)
    .then((response) => response.json())
    .then((response) => (responseValues = response))
    .catch((err) => console.error(err))

  if (responseValues && responseValues['result']) {
    console.log('UserOperation submitted. Hash:', responseValues['result'])
    console.log('UserOp Link: https://jiffyscan.xyz/userOpHash/' + responseValues['result'] + '?network=' + chain)

    const hashOptions = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_getUserOperationReceipt',
        params: [responseValues['result']],
        entryPoint: entryPointAddress,
      }),
    }
    let runOnce = true

    while (responseValues['result'] == null || runOnce) {
      await setTimeout(25000)
      await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, hashOptions)
        .then((response) => response.json())
        .then((response) => (responseValues = response))
        .catch((err) => console.error(err))
      runOnce = false
    }

    if (responseValues['result'] && responseValues['result']['receipt']['transactionHash']) {
      console.log('\nTransaction Link: https://' + chain + '.etherscan.io/tx/' + responseValues['result']['receipt']['transactionHash'])
      const actualGasUsed = fromHex(responseValues['result']['actualGasUsed'], 'number')
      const gasUsed = fromHex(responseValues['result']['receipt']['gasUsed'], 'number')
      console.log(`\nGas Used (Account or Paymaster): ${actualGasUsed}`)
      console.log(`Gas Used (Transaction): ${gasUsed}\n`)
    } else {
      console.log('\n' + responseValues['error'])
    }
  } else {
    if (responseValues && responseValues['error']['message']) {
      console.log('\n' + responseValues['error']['message'])
    }
  }
}

export const createCallData = async (
  chain: string,
  publicClient: any,
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
      await mintERC20Token(erc20TokenAddress, publicClient, signer, senderAddress, erc20Amount, chain, paymaster)

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

export function toPackedUserOperation(unpackedUserOperation: UserOperation): Record<string, any> {
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
