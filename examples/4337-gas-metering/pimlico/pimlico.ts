import dotenv from 'dotenv'
import { ethers } from 'ethers'
import { getAccountNonce, bundlerActions, ENTRYPOINT_ADDRESS_V07, getRequiredPrefund } from 'permissionless'
import { pimlicoBundlerActions, pimlicoPaymasterActions } from 'permissionless/actions/pimlico'
import { setTimeout } from 'timers/promises'
import { Client, Hash, createClient, createPublicClient, http, parseEther, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, sepolia } from 'viem/chains'
import { getAccountAddress, getAccountInitCode } from '../utils/safe'
import { SAFE_ADDRESSES_MAP } from '../utils/address'
import { UserOperation, submitUserOperationPimlico, signUserOperation, txTypes, createCallData } from '../utils/userOps'
import { transferETH } from '../utils/nativeTransfer'

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

// Detecting Paymaster based transaction or not.
const argv = process.argv.slice(2)
let usePaymaster = false
if (argv.length < 1 || argv.length > 2) {
  throw new Error('TX Type Argument not passed.')
} else if (argv.length == 2 && argv[1] == 'paymaster=true') {
  if (policyID) {
    usePaymaster = true
  } else {
    throw new Error('Paymaster requires policyID to be set.')
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

const pimlicoPaymasterClient = createClient({
  transport: http(`https://api.pimlico.io/v2/${chain}/rpc?apikey=${apiKey}`),
  chain: viemChain,
}).extend(pimlicoPaymasterActions(ENTRYPOINT_ADDRESS_V07))

// Get Safe Init Code.
const initCode = await getAccountInitCode({
  owner: signer.address,
  safeModuleSetupAddress: chainAddresses.SAFE_MODULE_SETUP_ADDRESS,
  safe4337ModuleAddress: chainAddresses.SAFE_4337_MODULE_ADDRESS,
  safeSingletonAddress: chainAddresses.SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress: multiSendAddress,
  erc20TokenAddress: usePaymaster ? usdcTokenAddress : zeroAddress,
  paymasterAddress: usePaymaster ? erc20PaymasterAddress : zeroAddress,
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
  erc20TokenAddress: usePaymaster ? usdcTokenAddress : zeroAddress,
  paymasterAddress: usePaymaster ? erc20PaymasterAddress : zeroAddress,
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
const userOp: UserOperation = {
  sender: senderAddress,
  nonce: newNonce,
  factory: contractCode ? undefined : chainAddresses.SAFE_PROXY_FACTORY_ADDRESS,
  factoryData: contractCode ? '0x' : initCode,
  callData: txCallData,
  callGasLimit: 0n, // All Gas Values will be filled by Estimation Response Data.
  verificationGasLimit: 0n,
  preVerificationGas: 0n,
  maxFeePerGas: 0n,
  maxPriorityFeePerGas: 0n,
  paymaster: erc20PaymasterAddress,
  paymasterVerificationGasLimit: 0n,
  paymasterPostOpGasLimit: 0n,
  paymasterData: '0x',
  signature: '0x',
}

// Sign the User Operation.
userOp.signature = await signUserOperation(userOp, signer, chainID, ENTRYPOINT_ADDRESS_V07, chainAddresses.SAFE_4337_MODULE_ADDRESS)

// Fetch Max Gas Price from Bundler.
const maxGasPriceResult = await bundlerClient.getUserOperationGasPrice()
userOp.maxFeePerGas = maxGasPriceResult.fast.maxFeePerGas
userOp.maxPriorityFeePerGas = maxGasPriceResult.fast.maxPriorityFeePerGas

// If Paymaster is used, then sponsor the User Operation.
if (usePaymaster) {
  const sponsorResult = await pimlicoPaymasterClient.sponsorUserOperation({
    userOperation: {
      sender: userOp.sender,
      nonce: userOp.nonce,
      factory: userOp.factory,
      factoryData: userOp.factoryData,
      callData: userOp.callData,
      maxFeePerGas: userOp.maxFeePerGas,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
      signature: userOp.signature,
    },
    sponsorshipPolicyId: policyID,
  })

  userOp.callGasLimit = sponsorResult.callGasLimit
  userOp.verificationGasLimit = sponsorResult.verificationGasLimit
  userOp.preVerificationGas = sponsorResult.preVerificationGas
  userOp.paymasterData = sponsorResult.paymasterData
  userOp.paymasterVerificationGasLimit = sponsorResult.paymasterVerificationGasLimit
  userOp.paymasterPostOpGasLimit = sponsorResult.paymasterPostOpGasLimit
} else {
  userOp.paymaster = undefined

  // Estimate Gas for the User Operation.
  const gasEstimate = await bundlerClient.estimateUserOperationGas({
    userOperation: userOp,
  })

  userOp.callGasLimit = gasEstimate.callGasLimit
  userOp.verificationGasLimit = gasEstimate.verificationGasLimit
  userOp.preVerificationGas = gasEstimate.preVerificationGas

  // Check Sender ETH Balance.
  let senderETHBalance = await publicClient.getBalance({ address: senderAddress })
  console.log('\nSender ETH Balance:', ethers.formatEther(senderETHBalance))

  // Checking required preFund.
  const requiredPrefund = getRequiredPrefund({ userOperation: userOp, entryPoint: ENTRYPOINT_ADDRESS_V07 })
  console.log('\nRequired Prefund:', ethers.formatEther(requiredPrefund))

  const requiredBalance = requiredPrefund + (txType == 'native-transfer' ? parseEther('0.000001') : 0n)

  if (senderETHBalance < requiredBalance) {
    await transferETH(publicClient, signer, senderAddress, requiredBalance - senderETHBalance, chain, paymaster)
    while (senderETHBalance < requiredBalance) {
      await setTimeout(15000)
      senderETHBalance = await publicClient.getBalance({ address: senderAddress })
    }
  }
}

// Sign the User Operation.
userOp.signature = await signUserOperation(userOp, signer, chainID, ENTRYPOINT_ADDRESS_V07, chainAddresses.SAFE_4337_MODULE_ADDRESS)

// Submit the User Operation.
await submitUserOperationPimlico(userOp, bundlerClient, ENTRYPOINT_ADDRESS_V07, chain)
