import dotenv from "dotenv";
import { getAccountNonce, bundlerActions } from "permissionless";
import {
  pimlicoBundlerActions,
  pimlicoPaymasterActions,
} from "permissionless/actions/pimlico";
import { setTimeout } from "timers/promises";
import { Client, Hash, createClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { goerli, polygonMumbai } from "viem/chains";
import {
  SAFE_ADDRESSES_MAP,
  getAccountAddress,
  getAccountInitCode,
} from "../utils/safe";
import {
  UserOperation,
  submitUserOperationPimlico,
  signUserOperation,
  txTypes,
  createCallData,
} from "../utils/userOps";
import {
  getERC20Decimals,
  getERC20Balance,
  transferERC20Token,
} from "../utils/erc20";

dotenv.config();
const paymaster = "pimlico";

const privateKey = process.env.PRIVATE_KEY;

const entryPointAddress = process.env
  .PIMLICO_ENTRYPOINT_ADDRESS as `0x${string}`;
const multiSendAddress = process.env.PIMLICO_MULTISEND_ADDRESS as `0x${string}`;

const saltNonce = BigInt(process.env.PIMLICO_NONCE as string);

const chain = process.env.PIMLICO_CHAIN;
const chainID = Number(process.env.PIMLICO_CHAIN_ID);

const safeVersion = process.env.SAFE_VERSION as string;

const rpcURL = process.env.PIMLICO_RPC_URL;
const policyID = process.env.PIMLICO_GAS_POLICY;
const apiKey = process.env.PIMLICO_API_KEY;

const erc20PaymasterAddress = process.env
  .PIMLICO_ERC20_PAYMASTER_ADDRESS as `0x${string}`;
const usdcTokenAddress = process.env
  .PIMLICO_USDC_TOKEN_ADDRESS as `0x${string}`;
const erc20TokenAddress = process.env
  .PIMLICO_ERC20_TOKEN_CONTRACT as `0x${string}`;
const erc721TokenAddress = process.env
  .PIMLICO_ERC721_TOKEN_CONTRACT as `0x${string}`;

const argv = process.argv.slice(2);
let usePaymaster!: boolean;
if (argv.length < 1 || argv.length > 2) {
  throw new Error("TX Type Argument not passed.");
} else if (argv.length == 2 && argv[1] == "paymaster=true") {
  if (policyID) {
    usePaymaster = true;
  } else {
    throw new Error("Paymaster requires policyID to be set.");
  }
}

const txType: string = argv[0];
if (!txTypes.includes(txType)) {
  throw new Error("TX Type Argument Invalid");
}

const safeAddresses = (
  SAFE_ADDRESSES_MAP as Record<string, Record<string, any>>
)[safeVersion];
let chainAddresses;
if (safeAddresses) {
  chainAddresses = safeAddresses[chainID];
}

if (apiKey === undefined) {
  throw new Error(
    "Please replace the `apiKey` env variable with your Pimlico API key",
  );
}

if (!privateKey) {
  throw new Error(
    "Please populate .env file with demo Private Key. Recommended to not use your personal private key.",
  );
}

const signer = privateKeyToAccount(privateKey as Hash);
console.log("Signer Extracted from Private Key.");

let bundlerClient;
let publicClient;
let pimlicoPaymasterClient;
if (chain == "goerli") {
  bundlerClient = createClient({
    transport: http(`https://api.pimlico.io/v1/${chain}/rpc?apikey=${apiKey}`),
    chain: goerli,
  })
    .extend(bundlerActions)
    .extend(pimlicoBundlerActions);

  publicClient = createPublicClient({
    transport: http(rpcURL),
    chain: goerli,
  });

  pimlicoPaymasterClient = createClient({
    transport: http(`https://api.pimlico.io/v2/${chain}/rpc?apikey=${apiKey}`),
    chain: goerli,
  }).extend(pimlicoPaymasterActions);
} else if (chain == "mumbai") {
  bundlerClient = createClient({
    transport: http(`https://api.pimlico.io/v1/${chain}/rpc?apikey=${apiKey}`),
    chain: polygonMumbai,
  })
    .extend(bundlerActions)
    .extend(pimlicoBundlerActions);

  publicClient = createPublicClient({
    transport: http(rpcURL),
    chain: polygonMumbai,
  });

  pimlicoPaymasterClient = createClient({
    transport: http(`https://api.pimlico.io/v2/${chain}/rpc?apikey=${apiKey}`),
    chain: polygonMumbai,
  }).extend(pimlicoPaymasterActions);
} else {
  throw new Error(
    "Current code only support limited networks. Please make required changes if you want to use custom network.",
  );
}

const initCode = await getAccountInitCode({
  owner: signer.address,
  addModuleLibAddress: chainAddresses.ADD_MODULES_LIB_ADDRESS,
  safe4337ModuleAddress: chainAddresses.SAFE_4337_MODULE_ADDRESS,
  safeProxyFactoryAddress: chainAddresses.SAFE_PROXY_FACTORY_ADDRESS,
  safeSingletonAddress: chainAddresses.SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress: multiSendAddress,
  erc20TokenAddress: usdcTokenAddress,
  paymasterAddress: erc20PaymasterAddress,
});
console.log("\nInit Code Created.");

const senderAddress = await getAccountAddress({
  client: publicClient,
  owner: signer.address,
  addModuleLibAddress: chainAddresses.ADD_MODULES_LIB_ADDRESS,
  safe4337ModuleAddress: chainAddresses.SAFE_4337_MODULE_ADDRESS,
  safeProxyFactoryAddress: chainAddresses.SAFE_PROXY_FACTORY_ADDRESS,
  safeSingletonAddress: chainAddresses.SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress: multiSendAddress,
  erc20TokenAddress: usdcTokenAddress,
  paymasterAddress: erc20PaymasterAddress,
});
console.log("\nCounterfactual Sender Address Created:", senderAddress);
if (chain == "mumbai") {
  console.log(
    "Address Link: https://mumbai.polygonscan.com/address/" + senderAddress,
  );
} else {
  console.log(
    "Address Link: https://" + chain + ".etherscan.io/address/" + senderAddress,
  );
}

const contractCode = await publicClient.getBytecode({ address: senderAddress });

if (contractCode) {
  console.log("\nThe Safe is already deployed.");
  if (txType == "account") {
    process.exit(0);
  }
} else {
  console.log(
    "\nDeploying a new Safe and executing calldata passed with it (if any).",
  );
}

const newNonce = await getAccountNonce(publicClient as Client, {
  entryPoint: entryPointAddress,
  sender: senderAddress,
});
console.log("\nNonce for the sender received from EntryPoint.");

const txCallData: `0x${string}` = await createCallData(
  chain,
  publicClient,
  signer,
  txType,
  senderAddress,
  erc20TokenAddress,
  erc721TokenAddress,
  paymaster,
);

const sponsoredUserOperation: UserOperation = {
  sender: senderAddress,
  nonce: newNonce,
  initCode: contractCode ? "0x" : initCode,
  callData: txCallData,
  callGasLimit: 1n, // All Gas Values will be filled by Estimation Response Data.
  verificationGasLimit: 1n,
  preVerificationGas: 1n,
  maxFeePerGas: 1n,
  maxPriorityFeePerGas: 1n,
  paymasterAndData: erc20PaymasterAddress,
  signature: "0x",
};

const gasEstimate = await bundlerClient.estimateUserOperationGas({
  userOperation: sponsoredUserOperation,
  entryPoint: entryPointAddress,
});
const maxGasPriceResult = await bundlerClient.getUserOperationGasPrice();

sponsoredUserOperation.callGasLimit = gasEstimate.callGasLimit;
sponsoredUserOperation.verificationGasLimit = gasEstimate.verificationGasLimit;
sponsoredUserOperation.preVerificationGas = gasEstimate.preVerificationGas;
sponsoredUserOperation.maxFeePerGas = maxGasPriceResult.fast.maxFeePerGas;
sponsoredUserOperation.maxPriorityFeePerGas =
  maxGasPriceResult.fast.maxPriorityFeePerGas;

if (usePaymaster) {
  const sponsorResult = await pimlicoPaymasterClient.sponsorUserOperation({
    userOperation: sponsoredUserOperation,
    entryPoint: entryPointAddress,
    sponsorshipPolicyId: policyID,
  });

  sponsoredUserOperation.callGasLimit = sponsorResult.callGasLimit;
  sponsoredUserOperation.verificationGasLimit =
    sponsorResult.verificationGasLimit;
  sponsoredUserOperation.preVerificationGas = sponsorResult.preVerificationGas;
  sponsoredUserOperation.paymasterAndData = sponsorResult.paymasterAndData;
} else {
  // Fetch USDC balance of sender
  const usdcDecimals = await getERC20Decimals(usdcTokenAddress, publicClient);
  const usdcAmount = BigInt(10 ** usdcDecimals);
  let senderUSDCBalance = await getERC20Balance(
    usdcTokenAddress,
    publicClient,
    senderAddress,
  );
  console.log(
    "\nSafe Wallet USDC Balance:",
    Number(senderUSDCBalance / usdcAmount),
  );

  if (senderUSDCBalance < BigInt(1) * usdcAmount) {
    console.log(
      "\nTransferring 1 USDC Token for paying the Paymaster from Sender to Safe.",
    );
    await transferERC20Token(
      usdcTokenAddress,
      publicClient,
      signer,
      senderAddress,
      BigInt(1) * usdcAmount,
      chain,
      paymaster,
    );
    while (senderUSDCBalance < BigInt(1) * usdcAmount) {
      await setTimeout(15000);
      senderUSDCBalance = await getERC20Balance(
        usdcTokenAddress,
        publicClient,
        senderAddress,
      );
    }
    console.log(
      "\nUpdated Safe Wallet USDC Balance:",
      Number(senderUSDCBalance / usdcAmount),
    );
  }
}

sponsoredUserOperation.signature = await signUserOperation(
  sponsoredUserOperation,
  signer,
  chainID,
  entryPointAddress,
  chainAddresses.SAFE_4337_MODULE_ADDRESS,
);

await submitUserOperationPimlico(
  sponsoredUserOperation,
  bundlerClient,
  entryPointAddress,
  chain,
);
