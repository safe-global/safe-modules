import dotenv from "dotenv";
import { getAccountNonce } from "permissionless";
import { UserOperation, bundlerActions, getSenderAddress } from "permissionless";
import { pimlicoBundlerActions } from "permissionless/actions/pimlico";
import { Address, Hash, createClient, createPublicClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { goerli } from "viem/chains";
import { EIP712_SAFE_OPERATION_TYPE, SAFE_ADDRESSES_MAP, encodeCallData, getAccountAddress, getAccountInitCode } from "./utils/safe";
import { submitUserOperation, signUserOperation } from "./utils/userOps";
import { setTimeout } from "timers/promises";
import { generateTransferCallData, getERC20Decimals, getERC20Balance, mintERC20Token } from "./utils/erc20";

dotenv.config()

const privateKey = process.env.PRIVATE_KEY;
const ENTRY_POINT_ADDRESS = process.env.PIMLICO_ENTRYPOINT_ADDRESS;
const multiSendAddress = process.env.PIMLICO_MULTISEND_ADDRESS;
const saltNonce = BigInt(process.env.PIMLICO_ACCOUNT_NONCE);
const chain = process.env.PIMLICO_CHAIN;
const chainID = Number(process.env.PIMLICO_CHAIN_ID);
const safeVersion = process.env.SAFE_VERSION;
const rpcURL = process.env.PIMLICO_RPC_URL;
const apiKey = process.env.PIMLICO_API_KEY;
const erc20PaymasterAddress = process.env.PIMLICO_ERC20_PAYMASTER_ADDRESS;
const usdcTokenAddress = process.env.PIMLICO_USDC_TOKEN_ADDRESS;

if (apiKey === undefined) {
  throw new Error(
    "Please replace the `apiKey` env variable with your Pimlico API key"
  );
}

if(!privateKey){
  throw new Error(
    "Please populate .env file with demo Private Key. Recommended to not use your personal private key."
  );
}

const signer = privateKeyToAccount(privateKey as Hash);
console.log("Signer Extracted from Private Key.");

let bundlerClient;
let publicClient;
if(chain == "goerli"){
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
}
else {
  throw new Error(
    "Current code only support Sepolia and Goerli. Please make required changes if you want to use custom network."
  )
}

const initCode = await getAccountInitCode({
  owner: signer.address,
  addModuleLibAddress: SAFE_ADDRESSES_MAP[safeVersion][chainID].ADD_MODULES_LIB_ADDRESS,
  safe4337ModuleAddress: SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_4337_MODULE_ADDRESS,
  safeProxyFactoryAddress: SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_PROXY_FACTORY_ADDRESS,
  safeSingletonAddress: SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  erc20TokenAddress: usdcTokenAddress,
  multiSendAddress,
  paymasterAddress: erc20PaymasterAddress,
});
console.log("\nInit Code Created.");

const senderAddress = await getAccountAddress({
  client: publicClient,
  owner: signer.address,
  addModuleLibAddress: SAFE_ADDRESSES_MAP[safeVersion][chainID].ADD_MODULES_LIB_ADDRESS,
  safe4337ModuleAddress: SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_4337_MODULE_ADDRESS,
  safeProxyFactoryAddress: SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_PROXY_FACTORY_ADDRESS,
  safeSingletonAddress: SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  erc20TokenAddress: usdcTokenAddress,
  multiSendAddress,
  paymasterAddress: erc20PaymasterAddress,
});
console.log("\nCounterfactual Sender Address Created:", senderAddress);

// TODO This and in other files, this might be made easier with chain substituted at the right place.
if(chain == "goerli"){
  console.log("Address Link: https://goerli.etherscan.io/address/"+senderAddress);
}
else {
  throw new Error(
    "Current code only support Sepolia and Goerli. Please make required changes if you want to use custom network."
  )
}

const usdcDecimals = await getERC20Decimals(usdcTokenAddress, publicClient);
const usdcAmount = BigInt(10 ** usdcDecimals);
let senderUSDCBalance = await getERC20Balance(usdcTokenAddress, publicClient, senderAddress);
console.log("\nSafe Wallet USDC Balance:", Number(senderUSDCBalance / usdcAmount));

if(senderUSDCBalance < usdcAmount) {
  console.log("\nPlease deposit atleast 1 USDC Token for paying the Paymaster.");
  while (senderUSDCBalance < usdcAmount) {
    await setTimeout(30000);
    senderUSDCBalance = await getERC20Balance(usdcTokenAddress, publicClient, senderAddress);
  }
  console.log("\nUpdated Safe Wallet USDC Balance:", Number(senderUSDCBalance / usdcAmount));    
}

const gasPriceResult = await bundlerClient.getUserOperationGasPrice();

const newNonce = await getAccountNonce(publicClient, {
  entryPoint: ENTRY_POINT_ADDRESS,
  sender: senderAddress,
});
console.log("\nNonce for the sender received from EntryPoint.")

const contractCode = await publicClient.getBytecode({ address: senderAddress });

if (contractCode) {
  console.log("\nThe Safe is already deployed.\n");
} else {
  console.log("\nDeploying a new Safe.\n");

  const sponsoredUserOperation: UserOperation = {
    sender: senderAddress,
    nonce: newNonce,
    initCode: contractCode ? "0x" : initCode,
    callData: encodeCallData({
      to: senderAddress,
      data: "0xe75235b8", // getThreshold() of the Safe
      value: 0n,
    }),
    callGasLimit: 100_000n, // hardcode it for now at a high value
    verificationGasLimit: 500_000n, // hardcode it for now at a high value
    preVerificationGas: 50_000n, // hardcode it for now at a high value
    maxFeePerGas: gasPriceResult.fast.maxFeePerGas,
    maxPriorityFeePerGas: gasPriceResult.fast.maxPriorityFeePerGas,
    paymasterAndData: erc20PaymasterAddress, // to use the erc20 paymaster, put its address in the paymasterAndData field
    signature: "0x",
  };
  
  sponsoredUserOperation.signature = await signUserOperation(sponsoredUserOperation, signer);
  
  await submitUserOperation(sponsoredUserOperation, bundlerClient);
}