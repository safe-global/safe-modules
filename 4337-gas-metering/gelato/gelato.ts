import dotenv from "dotenv";
import { getAccountNonce } from "permissionless";
import { Client, Hash, createPublicClient, http, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  SAFE_ADDRESSES_MAP,
  getAccountAddress,
  getAccountInitCode,
} from "../utils/safe";
import {
  UserOperation,
  signUserOperation,
  txTypes,
  getGasValuesFromGelato,
  submitUserOperationGelato,
  createCallData,
} from "../utils/userOps";

dotenv.config();
const paymaster = "gelato";

const privateKey = process.env.PRIVATE_KEY;

const entryPointAddress = process.env
  .GELATO_ENTRYPOINT_ADDRESS as `0x${string}`;
const multiSendAddress = process.env.GELATO_MULTISEND_ADDRESS as `0x${string}`;

const saltNonce = BigInt(process.env.GELATO_NONCE as string);

const chain = process.env.GELATO_CHAIN;
const chainID = Number(process.env.GELATO_CHAIN_ID);

const safeVersion = process.env.SAFE_VERSION as string;

const rpcURL = process.env.GELATO_RPC_URL;
const policyID = process.env.GELATO_GAS_POLICY;
const apiKey = process.env.GELATO_API_KEY;

const erc20TokenAddress = process.env
  .GELATO_ERC20_TOKEN_CONTRACT as `0x${string}`;
const erc721TokenAddress = process.env
  .GELATO_ERC721_TOKEN_CONTRACT as `0x${string}`;

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
    "Please replace the `apiKey` env variable with your Alchemy API key",
  );
}

if (!privateKey) {
  throw new Error(
    "Please populate .env file with demo Private Key. Recommended to not use your personal private key.",
  );
}

const signer = privateKeyToAccount(privateKey as Hash);
console.log("Signer Extracted from Private Key.");

let publicClient;
if (chain == "sepolia") {
  publicClient = createPublicClient({
    transport: http(rpcURL),
    chain: sepolia,
  });
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
  erc20TokenAddress: zeroAddress,
  paymasterAddress: zeroAddress,
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
  erc20TokenAddress: zeroAddress,
  paymasterAddress: zeroAddress,
});
console.log("\nCounterfactual Sender Address Created:", senderAddress);
console.log(
  "Address Link: https://" + chain + ".etherscan.io/address/" + senderAddress,
);

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
  paymasterAndData: "0x",
  signature: "0x",
};

sponsoredUserOperation.signature = await signUserOperation(
  sponsoredUserOperation,
  signer,
  chainID,
  entryPointAddress,
  chainAddresses.SAFE_4337_MODULE_ADDRESS,
);
console.log("\nSigned Dummy Data for Gelato.");

if (usePaymaster) {
  throw new Error("Currently paymaster is not supported for Gelato.");
} else {
  sponsoredUserOperation.maxPriorityFeePerGas = 0n; // Gelato prefers to keep it to zero.
  sponsoredUserOperation.maxFeePerGas = 0n;

  const rvGas = await getGasValuesFromGelato(
    entryPointAddress,
    sponsoredUserOperation,
    chainID,
    apiKey,
  );

  sponsoredUserOperation.preVerificationGas = rvGas?.preVerificationGas;
  sponsoredUserOperation.callGasLimit = rvGas?.callGasLimit;
  // sponsoredUserOperation.callGasLimit = "0x186a0" as any;
  sponsoredUserOperation.verificationGasLimit = rvGas?.verificationGasLimit;
}

sponsoredUserOperation.signature = await signUserOperation(
  sponsoredUserOperation,
  signer,
  chainID,
  entryPointAddress,
  chainAddresses.SAFE_4337_MODULE_ADDRESS,
);
console.log("\nSigned Real Data for Gelato.");

await submitUserOperationGelato(
  entryPointAddress,
  sponsoredUserOperation,
  chain,
  chainID,
  apiKey,
);
