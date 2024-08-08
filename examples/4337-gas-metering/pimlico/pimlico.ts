import dotenv from 'dotenv'
import { getAccountNonce, bundlerActions, ENTRYPOINT_ADDRESS_V07 } from 'permissionless'
import { pimlicoBundlerActions, pimlicoPaymasterActions } from 'permissionless/actions/pimlico'
import { setTimeout } from 'timers/promises'
import { Client, Hash, createClient, createPublicClient, encodeFunctionData, http, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, sepolia } from 'viem/chains'
import { getAccountAddress, getAccountInitCode } from '../utils/safe'
import { SAFE_ADDRESSES_MAP } from '../utils/address'
import {
  UserOperation,
  submitUserOperationPimlico,
  signUserOperation,
  txTypes,
  createCallData,
  toPackedUserOperation,
} from '../utils/userOps'
import { getERC20Decimals, getERC20Balance, transferERC20Token } from '../utils/erc20'
import { EntryPointV07SimulationsAbi, PimlicoEntryPointSimulationsAbi } from './entrypointAbi'
import { SAFE_4337_MODULE_ABI } from '../utils/abi'

dotenv.config()
// For Paymaster Identification.
const paymaster = 'pimlico'

// Private Key of user initiating the transaction.
const privateKey = process.env.PRIVATE_KEY

// MultiSend Contract Address.
const multiSendAddress = process.env.PIMLICO_MULTISEND_ADDRESS as `0x${string}`

// Salt Nonce for Safe Address Generation.
const saltNonce = BigInt(process.env.PIMLICO_NONCE as string)

// Chain and Chain ID.
const chain = process.env.PIMLICO_CHAIN
const chainID = Number(process.env.PIMLICO_CHAIN_ID)

// Safe Version.
const safeVersion = process.env.SAFE_VERSION as string

// Chain & Provider related information.
const rpcURL = process.env.PIMLICO_RPC_URL
const policyID = process.env.PIMLICO_GAS_POLICY
const apiKey = process.env.PIMLICO_API_KEY

// Paymaster and Token Addresses.
const erc20PaymasterAddress = process.env.PIMLICO_ERC20_PAYMASTER_ADDRESS as `0x${string}`
const usdcTokenAddress = process.env.PIMLICO_USDC_TOKEN_ADDRESS as `0x${string}`
const erc20TokenAddress = process.env.PIMLICO_ERC20_TOKEN_CONTRACT as `0x${string}`
const erc721TokenAddress = process.env.PIMLICO_ERC721_TOKEN_CONTRACT as `0x${string}`

// Logging preference
const VERBOSE = process.env.VERBOSE === 'true'

enum UserOperationType {
  ERC20Paymaster = 'erc20-paymaster',
  VerifyingPaymaster = 'verifying-paymaster',
}

// Detecting which paymaster to use
const argv = process.argv.slice(2)
let transactionType = UserOperationType.ERC20Paymaster
if (argv.length < 1 || argv.length > 2) {
  throw new Error('TX Type Argument not passed.')
} else if (argv.length == 2 && argv[1] == 'verifyingPaymaster=true') {
  transactionType = UserOperationType.VerifyingPaymaster
  if (policyID) {
    console.log(`Using sponsorship policy. Leave it empty if you're using testnets, 
      Pimlico has a weird bug where it requires positive fiat balance if policy id is provided`)
  } else {
    console.warn(`Sponsorship Policy ID is not provided. This will only work for testnets, as pimlico are sponsoring the operations.`)
  }
}

// Transaction Type detection.
const txType: string = argv[0]
if (!txTypes.includes(txType)) {
  throw new Error('TX Type Argument Invalid')
}

// Safe Addresses of particular Chain.
const chainAddresses = SAFE_ADDRESSES_MAP[safeVersion]?.[chainID]
if (!chainAddresses) {
  throw new Error('Missing deployment information for the passed Safe Version & chainID.')
}

// Check if API Key is set.
if (apiKey === undefined) {
  throw new Error('Please replace the `apiKey` env variable with your Pimlico API key')
}

// Check if Private Key is set.
if (!privateKey) {
  throw new Error('Please populate .env file with demo Private Key. Recommended to not use your personal private key.')
}

// Check if the network is supported.
if (chain != 'sepolia' && chain != 'base-sepolia') {
  throw new Error('Current code only support limited networks. Please make required changes if you want to use custom network.')
}

// Extract Signer from Private Key.
const signer = privateKeyToAccount(privateKey as Hash)
console.log('Signer Extracted from Private Key.')

// Create a public, bundler and paymaster Client for the Chain.
const viemChain = chain == 'sepolia' ? sepolia : baseSepolia
const bundlerClient = createClient({
  transport: http(`https://api.pimlico.io/v2/${chain}/rpc?apikey=${apiKey}`),
  chain: viemChain,
})
  .extend(bundlerActions(ENTRYPOINT_ADDRESS_V07))
  .extend(pimlicoBundlerActions(ENTRYPOINT_ADDRESS_V07))

const publicClient = createPublicClient({
  transport: http(rpcURL),
  chain: viemChain,
})

const pimlicoPaymasterClient = bundlerClient.extend(pimlicoPaymasterActions(ENTRYPOINT_ADDRESS_V07))

// Get Safe Init Code.
const initCode = await getAccountInitCode({
  owner: signer.address,
  safeModuleSetupAddress: chainAddresses.SAFE_MODULE_SETUP_ADDRESS,
  safe4337ModuleAddress: chainAddresses.SAFE_4337_MODULE_ADDRESS,
  safeSingletonAddress: chainAddresses.SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress: multiSendAddress,
  erc20TokenAddress: transactionType === UserOperationType.ERC20Paymaster ? usdcTokenAddress : zeroAddress,
  paymasterAddress: transactionType === UserOperationType.ERC20Paymaster ? erc20PaymasterAddress : zeroAddress,
})
console.log('\nInit Code Created.')

// Get Safe Address Counterfactually.
const senderAddress = await getAccountAddress({
  owner: signer.address,
  client: publicClient,
  safeModuleSetupAddress: chainAddresses.SAFE_MODULE_SETUP_ADDRESS,
  safe4337ModuleAddress: chainAddresses.SAFE_4337_MODULE_ADDRESS,
  safeProxyFactoryAddress: chainAddresses.SAFE_PROXY_FACTORY_ADDRESS,
  safeSingletonAddress: chainAddresses.SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress: multiSendAddress,
  erc20TokenAddress: transactionType === UserOperationType.ERC20Paymaster ? usdcTokenAddress : zeroAddress,
  paymasterAddress: transactionType === UserOperationType.ERC20Paymaster ? erc20PaymasterAddress : zeroAddress,
})
console.log('\nCounterfactual Sender Address Created:', senderAddress)
if (chain == 'base-sepolia') {
  console.log('Address Link: https://sepolia.basescan.org/address/' + senderAddress)
} else {
  console.log('Address Link: https://' + chain + '.etherscan.io/address/' + senderAddress)
}

// Check if Safe is already deployed.
const contractCode = await publicClient.getBytecode({ address: senderAddress })

// If Safe is already deployed and TxType is `account`, then exit.
// Else, deploy a new Safe and execute the calldata passed with it (if any).
if (contractCode) {
  console.log('\nThe Safe is already deployed.')
  if (txType == 'account') {
    process.exit(0)
  }
} else {
  console.log('\nDeploying a new Safe and executing calldata passed with it (if any).')
}

// Get Nonce for the sender from EntryPoint.
const newNonce = await getAccountNonce(publicClient as Client, {
  entryPoint: ENTRYPOINT_ADDRESS_V07,
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

// Create User Operation Object.
const sponsoredUserOperation: UserOperation = {
  sender: senderAddress,
  nonce: newNonce,
  factory: contractCode ? undefined : chainAddresses.SAFE_PROXY_FACTORY_ADDRESS,
  factoryData: contractCode ? '0x' : initCode,
  callData: txCallData,
  callGasLimit: 1n, // All Gas Values will be filled by Estimation Response Data.
  verificationGasLimit: 1n,
  preVerificationGas: 1n,
  maxFeePerGas: 1n,
  maxPriorityFeePerGas: 1n,
  paymaster: erc20PaymasterAddress,
  paymasterVerificationGasLimit: 1n,
  paymasterPostOpGasLimit: 1n,
  paymasterData: '0x',
  signature: '0x',
}

// Sign the User Operation.
sponsoredUserOperation.signature = await signUserOperation(
  sponsoredUserOperation,
  signer,
  chainID,
  ENTRYPOINT_ADDRESS_V07,
  chainAddresses.SAFE_4337_MODULE_ADDRESS,
)

// Estimate gas and gas price for the User Operation.
const maxGasPriceResult = await pimlicoPaymasterClient.getUserOperationGasPrice()
sponsoredUserOperation.maxFeePerGas = maxGasPriceResult.fast.maxFeePerGas
sponsoredUserOperation.maxPriorityFeePerGas = maxGasPriceResult.fast.maxPriorityFeePerGas

const gasEstimate = await pimlicoPaymasterClient.estimateUserOperationGas({
  userOperation: sponsoredUserOperation,
})
sponsoredUserOperation.callGasLimit = gasEstimate.callGasLimit
sponsoredUserOperation.verificationGasLimit = gasEstimate.verificationGasLimit
sponsoredUserOperation.preVerificationGas = gasEstimate.preVerificationGas
sponsoredUserOperation.paymasterVerificationGasLimit = gasEstimate.paymasterVerificationGasLimit
sponsoredUserOperation.paymasterPostOpGasLimit = gasEstimate.paymasterPostOpGasLimit

// If Verifying Paymaster, then sponsor the User Operation.
if (transactionType === UserOperationType.VerifyingPaymaster) {
  const sponsorResult = await pimlicoPaymasterClient.sponsorUserOperation({
    userOperation: {
      sender: sponsoredUserOperation.sender,
      nonce: sponsoredUserOperation.nonce,
      factory: sponsoredUserOperation.factory,
      factoryData: sponsoredUserOperation.factoryData,
      callData: sponsoredUserOperation.callData,
      maxFeePerGas: sponsoredUserOperation.maxFeePerGas,
      maxPriorityFeePerGas: sponsoredUserOperation.maxPriorityFeePerGas,
      signature: sponsoredUserOperation.signature,
    },
    sponsorshipPolicyId: policyID,
  })

  sponsoredUserOperation.paymaster = sponsorResult.paymaster
  sponsoredUserOperation.callGasLimit = sponsorResult.callGasLimit
  sponsoredUserOperation.verificationGasLimit = sponsorResult.verificationGasLimit
  sponsoredUserOperation.preVerificationGas = sponsorResult.preVerificationGas
  sponsoredUserOperation.paymasterData = sponsorResult.paymasterData
  sponsoredUserOperation.paymasterVerificationGasLimit = sponsorResult.paymasterVerificationGasLimit
  sponsoredUserOperation.paymasterPostOpGasLimit = sponsorResult.paymasterPostOpGasLimit
} else {
  // Fetch USDC balance of sender
  const usdcDecimals = BigInt(await getERC20Decimals(usdcTokenAddress, publicClient))
  const usdcDenomination = 10n ** usdcDecimals
  const usdcAmount = 1n * usdcDenomination
  let senderUSDCBalance = await getERC20Balance(usdcTokenAddress, publicClient, senderAddress)
  console.log('\nSafe Wallet USDC Balance:', Number(senderUSDCBalance / usdcDenomination))

  if (senderUSDCBalance < usdcAmount) {
    console.log(`\nTransferring ${usdcAmount / usdcDenomination} USDC Token for paying the Paymaster from Sender to Safe.`)
    await transferERC20Token(usdcTokenAddress, publicClient, signer, senderAddress, usdcAmount, paymaster)
    while (senderUSDCBalance < usdcAmount) {
      await setTimeout(15000)
      senderUSDCBalance = await getERC20Balance(usdcTokenAddress, publicClient, senderAddress)
    }
    console.log('\nUpdated Safe Wallet USDC Balance:', Number(senderUSDCBalance / usdcDenomination))
  }
}

if (VERBOSE) {
  console.log(
    'User operation hash (from the 4337 module): ',
    await publicClient.readContract({
      abi: SAFE_4337_MODULE_ABI,
      address: chainAddresses.SAFE_4337_MODULE_ADDRESS,
      functionName: 'getOperationHash',
      args: [toPackedUserOperation(sponsoredUserOperation)],
    }),
  )
}

// Sign the User Operation.
sponsoredUserOperation.signature = await signUserOperation(
  sponsoredUserOperation,
  signer,
  chainID,
  ENTRYPOINT_ADDRESS_V07,
  chainAddresses.SAFE_4337_MODULE_ADDRESS,
)

if (VERBOSE) {
  const packedUserOperation = toPackedUserOperation(sponsoredUserOperation)
  const entryPointSimulationsSimulateHandleOpCallData = encodeFunctionData({
    abi: EntryPointV07SimulationsAbi,
    functionName: 'simulateHandleOp',
    args: [packedUserOperation],
  })
  const entryPointSimulationsSimulateTargetCallData = encodeFunctionData({
    abi: EntryPointV07SimulationsAbi,
    functionName: 'simulateCallData',
    args: [packedUserOperation, zeroAddress, '0x'],
  })

  const pimlicoSimulationsCallData = encodeFunctionData({
    abi: PimlicoEntryPointSimulationsAbi,
    functionName: 'simulateEntryPoint',
    args: [ENTRYPOINT_ADDRESS_V07, [entryPointSimulationsSimulateHandleOpCallData, entryPointSimulationsSimulateTargetCallData]],
  })
  console.log('\nEncoded Call Data for simulateEntryPoint: ', pimlicoSimulationsCallData)
  console.log(
    `\nYou can use the call data above to simulate the User Operation on the Pimlico EntryPointSimulations contract at 0xb02456a0ec77837b22156cba2ff53e662b326713 and Tenderly: https://tenderly.co.`,
  )
}

// Submit the User Operation.
await submitUserOperationPimlico(sponsoredUserOperation, bundlerClient, ENTRYPOINT_ADDRESS_V07, chain)
