import dotenv from 'dotenv'
import { getAccountNonce } from 'permissionless'
import { Network, Alchemy } from 'alchemy-sdk'
import { setTimeout } from 'timers/promises'
import { PublicClient, Hash, Transport, createPublicClient, formatEther, http, parseEther, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { goerli, sepolia } from 'viem/chains'
import { getAccountAddress, getAccountInitCode } from '../utils/safe'
import { SAFE_ADDRESSES_MAP } from '../utils/address'
import {
  UserOperation,
  signUserOperation,
  txTypes,
  getGasValuesFromAlchemyPaymaster,
  getFeeValuesFromAlchemy,
  getMaxFeePerGas,
  getGasValuesFromAlchemy,
  submitUserOperationAlchemy,
  createCallData,
} from '../utils/userOps'
import { transferETH } from '../utils/nativeTransfer'

dotenv.config()
const paymaster = 'alchemy'

const privateKey = process.env.PRIVATE_KEY

const entryPointAddress = process.env.ALCHEMY_ENTRYPOINT_ADDRESS as `0x${string}`
const multiSendAddress = process.env.ALCHEMY_MULTISEND_ADDRESS as `0x${string}`

const saltNonce = BigInt(process.env.ALCHEMY_NONCE as string)

const chain = process.env.ALCHEMY_CHAIN
const chainID = Number(process.env.ALCHEMY_CHAIN_ID)

const safeVersion = process.env.SAFE_VERSION as string

const rpcURL = process.env.ALCHEMY_RPC_URL
const policyID = process.env.ALCHEMY_GAS_POLICY
const apiKey = process.env.ALCHEMY_API_KEY

const erc20TokenAddress = process.env.ALCHEMY_ERC20_TOKEN_CONTRACT as `0x${string}`
const erc721TokenAddress = process.env.ALCHEMY_ERC721_TOKEN_CONTRACT as `0x${string}`

const argv = process.argv.slice(2)
let usePaymaster!: boolean
if (argv.length < 1 || argv.length > 2) {
  throw new Error('TX Type Argument not passed.')
} else if (argv.length == 2 && argv[1] == 'paymaster=true') {
  if (policyID) {
    usePaymaster = true
  } else {
    throw new Error('Paymaster requires policyID to be set.')
  }
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

const signer = privateKeyToAccount(privateKey as Hash)
console.log('Signer Extracted from Private Key.')

let publicClient: PublicClient<Transport<'http'>, typeof goerli | typeof sepolia>
let settings
if (chain == 'sepolia') {
  publicClient = createPublicClient({
    transport: http(rpcURL),
    chain: sepolia,
  })
  settings = {
    apiKey: apiKey,
    network: Network.ETH_SEPOLIA,
  }
} else if (chain == 'goerli') {
  publicClient = createPublicClient({
    transport: http(rpcURL),
    chain: goerli,
  })
  settings = {
    apiKey: apiKey,
    network: Network.ETH_GOERLI,
  }
} else {
  throw new Error('Current code only support limited networks. Please make required changes if you want to use custom network.')
}

const alchemy = new Alchemy(settings)

const initCode = await getAccountInitCode({
  owner: signer.address,
  addModuleLibAddress: chainAddresses.ADD_MODULES_LIB_ADDRESS,
  safe4337ModuleAddress: chainAddresses.SAFE_4337_MODULE_ADDRESS,
  safeProxyFactoryAddress: chainAddresses.SAFE_PROXY_FACTORY_ADDRESS,
  safeSingletonAddress: chainAddresses.SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress: multiSendAddress,
  erc20TokenAddress: zeroAddress,
  paymasterAddress: zeroAddress,
})
console.log('\nInit Code Created.')

const senderAddress = await getAccountAddress({
  publicClient: publicClient,
  owner: signer.address,
  addModuleLibAddress: chainAddresses.ADD_MODULES_LIB_ADDRESS,
  safe4337ModuleAddress: chainAddresses.SAFE_4337_MODULE_ADDRESS,
  safeProxyFactoryAddress: chainAddresses.SAFE_PROXY_FACTORY_ADDRESS,
  safeSingletonAddress: chainAddresses.SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress: multiSendAddress,
  erc20TokenAddress: zeroAddress,
  paymasterAddress: zeroAddress,
})
console.log('\nCounterfactual Sender Address Created:', senderAddress)
console.log('Address Link: https://' + chain + '.etherscan.io/address/' + senderAddress)

const contractCode = await publicClient.getBytecode({ address: senderAddress })

if (contractCode) {
  console.log('\nThe Safe is already deployed.')
  if (txType == 'account') {
    process.exit(0)
  }
} else {
  console.log('\nDeploying a new Safe and executing calldata passed with it (if any).')
}

const newNonce = await getAccountNonce(publicClient, {
  entryPoint: entryPointAddress,
  sender: senderAddress,
})
console.log('\nNonce for the sender received from EntryPoint.')

const txCallData: `0x${string}` = await createCallData(
  chain,
  publicClient,
  signer,
  txType,
  senderAddress,
  erc20TokenAddress,
  erc721TokenAddress,
  paymaster,
)

const sponsoredUserOperation: UserOperation = {
  sender: senderAddress,
  nonce: newNonce,
  initCode: contractCode ? '0x' : initCode,
  callData: txCallData,
  callGasLimit: 1n, // All Gas Values will be filled by Estimation Response Data.
  verificationGasLimit: 1n,
  preVerificationGas: 1n,
  maxFeePerGas: 1n,
  maxPriorityFeePerGas: 1n,
  paymasterAndData: '0x',
  signature: '0x',
}

sponsoredUserOperation.signature = await signUserOperation(
  sponsoredUserOperation,
  signer,
  chainID,
  entryPointAddress,
  chainAddresses.SAFE_4337_MODULE_ADDRESS,
)
console.log('\nSigned Dummy Data for Paymaster Data Creation from Alchemy.')

if (usePaymaster) {
  const rvGas = await getGasValuesFromAlchemyPaymaster(policyID, entryPointAddress, sponsoredUserOperation, chain, apiKey)

  sponsoredUserOperation.preVerificationGas = rvGas?.preVerificationGas
  sponsoredUserOperation.callGasLimit = rvGas?.callGasLimit
  sponsoredUserOperation.verificationGasLimit = rvGas?.verificationGasLimit
  sponsoredUserOperation.paymasterAndData = rvGas?.paymasterAndData
  sponsoredUserOperation.maxFeePerGas = rvGas?.maxFeePerGas
  sponsoredUserOperation.maxPriorityFeePerGas = rvGas?.maxPriorityFeePerGas
} else {
  sponsoredUserOperation.maxPriorityFeePerGas = await getFeeValuesFromAlchemy(chain, apiKey)
  sponsoredUserOperation.maxFeePerGas = await getMaxFeePerGas(alchemy, sponsoredUserOperation.maxPriorityFeePerGas)

  const rvGas = await getGasValuesFromAlchemy(entryPointAddress, sponsoredUserOperation, chain, apiKey)

  sponsoredUserOperation.preVerificationGas = rvGas?.preVerificationGas
  sponsoredUserOperation.callGasLimit = rvGas?.callGasLimit
  sponsoredUserOperation.verificationGasLimit = rvGas?.verificationGasLimit

  const weiToSend = parseEther('0.02')
  let safeETHBalance = await publicClient.getBalance({
    address: senderAddress,
  })
  if (safeETHBalance < weiToSend) {
    console.log('\nTransferring', formatEther(weiToSend - safeETHBalance), 'ETH to Safe for transaction.')
    await transferETH(publicClient, signer, senderAddress, weiToSend - safeETHBalance, chain, paymaster)
    while (safeETHBalance < weiToSend) {
      await setTimeout(30000) // Sometimes it takes time to index.
      safeETHBalance = await publicClient.getBalance({
        address: senderAddress,
      })
    }
    console.log('\nTransferred required ETH for the transaction.')
  }
}

sponsoredUserOperation.signature = await signUserOperation(
  sponsoredUserOperation,
  signer,
  chainID,
  entryPointAddress,
  chainAddresses.SAFE_4337_MODULE_ADDRESS,
)
console.log('\nSigned Real Data including Paymaster Data Created by Alchemy.\n')

await submitUserOperationAlchemy(entryPointAddress, sponsoredUserOperation, chain, apiKey)
