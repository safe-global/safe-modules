import dotenv from 'dotenv'
import { Address, Hash, createPublicClient, http, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, sepolia } from 'viem/chains'
import { getAccountAddress, getGelatoAccountInitCode, getGelatoCallData, prepareForGelatoTx } from '../utils/safe'
import { SAFE_ADDRESSES_MAP } from '../utils/address'
import { txTypes } from '../utils/userOps'
import { GelatoRelay } from '@gelatonetwork/relay-sdk'
import { setTimeout } from 'timers/promises'

dotenv.config()

const privateKey = process.env.PRIVATE_KEY

const multiSendAddress = process.env.GELATO_MULTISEND_ADDRESS as `0x${string}`

const saltNonce = BigInt(process.env.GELATO_NONCE as string)

const chain = process.env.GELATO_CHAIN
const chainID = Number(process.env.GELATO_CHAIN_ID)

const safeVersion = process.env.SAFE_VERSION as string

const rpcURL = process.env.GELATO_RPC_URL
const apiKey = process.env.GELATO_API_KEY

const erc20TokenAddress = process.env.GELATO_ERC20_TOKEN_CONTRACT as Address
const erc721TokenAddress = process.env.GELATO_ERC721_TOKEN_CONTRACT as Address

const argv = process.argv.slice(2)
if (argv.length != 1) {
  throw new Error('TX Type Argument not passed.')
}

const txType: string = argv[0]
if (!txTypes.includes(txType)) {
  throw new Error('TX Type Argument Invalid')
}

const chainAddresses = SAFE_ADDRESSES_MAP[safeVersion]?.[chainID]
if (!chainAddresses) {
  throw new Error('Missing deployment information for the passed Safe Version & chainID.')
}

if (apiKey === undefined) {
  throw new Error('Please replace the `apiKey` env variable with your Alchemy API key')
}

if (!privateKey) {
  throw new Error('Please populate .env file with demo Private Key. Recommended to not use your personal private key.')
}

// Check if the network is supported.
if (chain != 'sepolia' && chain != 'base-sepolia') {
  throw new Error('Current code only support limited networks. Please make required changes if you want to use custom network.')
}

const signer = privateKeyToAccount(privateKey as Hash)
console.log('Signer Extracted from Private Key.')

const viemChain = chain === 'sepolia' ? sepolia : baseSepolia
const publicClient = createPublicClient({
  transport: http(rpcURL),
  chain: viemChain,
})

// Creating the Account Init Code.
let requestData = await getGelatoAccountInitCode({
  owner: signer.address,
  client: publicClient,
  txType: txType,
  safeModuleSetupAddress: chainAddresses.SAFE_MODULE_SETUP_ADDRESS,
  safe4337ModuleAddress: chainAddresses.SAFE_4337_MODULE_ADDRESS,
  safeSingletonAddress: chainAddresses.SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress: multiSendAddress,
  erc20TokenAddress: erc20TokenAddress,
  erc721TokenAddress: erc721TokenAddress,
})
console.log('\nInit Code Created.')

// Creating the Counterfactual Safe Address.
const senderAddress = await getAccountAddress({
  owner: signer.address,
  client: publicClient,
  txType: txType,
  safeModuleSetupAddress: chainAddresses.SAFE_MODULE_SETUP_ADDRESS,
  safe4337ModuleAddress: chainAddresses.SAFE_4337_MODULE_ADDRESS,
  safeProxyFactoryAddress: chainAddresses.SAFE_PROXY_FACTORY_ADDRESS,
  safeSingletonAddress: chainAddresses.SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress: multiSendAddress,
  erc20TokenAddress: erc20TokenAddress,
  erc721TokenAddress: erc721TokenAddress,
  paymasterAddress: zeroAddress,
  isGelato: true,
})
console.log('\nCounterfactual Sender Address Created:', senderAddress)
if (chain == 'base-sepolia') {
  console.log('Address Link: https://sepolia.basescan.org/address/' + senderAddress)
} else {
  console.log('Address Link: https://' + chain + '.etherscan.io/address/' + senderAddress)
}

// Preparing the Safe Account based on the Transaction.
await prepareForGelatoTx({
  signer,
  chain,
  publicClient,
  txType,
  senderAddress,
  erc20TokenAddress,
})

// Creating the request object for the Gelato Task.
let request

const contractCode = await publicClient.getBytecode({ address: senderAddress })
// Checking if the Safe is already deployed.
if (contractCode) {
  console.log('\nThe Safe is already deployed.')
  if (txType == 'account') {
    process.exit(0)
  }

  // Creating the Call Data if account is already created.
  console.log('\nExecuting calldata passed with the Safe.')
  requestData = await getGelatoCallData({
    safe: senderAddress,
    owner: signer,
    publicClient: publicClient,
    txType: txType,
    erc20TokenAddress: erc20TokenAddress,
    erc721TokenAddress: erc721TokenAddress,
  })
  console.log('\nSigned Calldata Created.')

  // Creating the Gelato Task Request Object.
  request = {
    chainId: BigInt(chainID),
    target: senderAddress,
    data: requestData,
  }
} else {
  console.log('\nDeploying a new Safe and executing calldata passed with it (if any).')

  // Creating the Gelato Task Request Object.
  request = {
    chainId: BigInt(chainID),
    target: chainAddresses.SAFE_PROXY_FACTORY_ADDRESS,
    data: requestData,
  }
}

// Creating the Gelato Relay Object.
const relay = new GelatoRelay()

// Executing the Gelato Task.
const relayResponse = await relay.sponsoredCall(request, apiKey)

// Logging the Gelato Task ID Link.
console.log('\nGelato Relay Task Link: https://api.gelato.digital/tasks/status/' + relayResponse['taskId'])

let taskStatus = await relay.getTaskStatus(relayResponse.taskId)
// Checking the Gelato Task Status.
while (taskStatus?.taskState !== 'ExecSuccess') {
  await setTimeout(25000)
  taskStatus = await relay.getTaskStatus(relayResponse.taskId)
}

// Based on the chain, logging the transaction link and tenderly gas detail.
if (chain == 'base-sepolia') {
  console.log('\nTransaction Link: https://sepolia.basescan.org/tx/' + (taskStatus.transactionHash ?? ''))
  console.log('\nGas Used: https://dashboard.tenderly.co/tx/' + chain + '/' + (taskStatus.transactionHash ?? '') + '/gas-usage')
} else {
  console.log('\nTransaction Link: https://' + chain + '.etherscan.io/tx/' + (taskStatus.transactionHash ?? ''))
  console.log('\nGas Used: https://dashboard.tenderly.co/tx/' + chain + '/' + (taskStatus.transactionHash ?? '') + '/gas-usage')
}

// Logging the Gas Used.
console.log('\nGas Used:', taskStatus.gasUsed)
