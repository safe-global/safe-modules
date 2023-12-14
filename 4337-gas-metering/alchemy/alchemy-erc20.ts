import dotenv from "dotenv";
import { getAccountNonce } from "permissionless";
import { UserOperation, signUserOperation, suoData } from "../utils/userOps";
import { Hash, createPublicClient, http, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { goerli, sepolia } from "viem/chains";
import {
  SAFE_ADDRESSES_MAP,
  encodeCallData,
  getAccountAddress,
  getAccountInitCode,
} from "../utils/safe";
import {
  generateTransferCallData,
  getERC20Decimals,
  getERC20Balance,
  mintERC20Token,
} from "../utils/erc20";
import { setTimeout } from "timers/promises";

dotenv.config();
const paymaster = "alchemy";
const privateKey = process.env.PRIVATE_KEY;
const entryPointAddress = process.env
  .ALCHEMY_ENTRYPOINT_ADDRESS as `0x${string}`;
const multiSendAddress = process.env.ALCHEMY_MULTISEND_ADDRESS as `0x${string}`;
const saltNonce = BigInt(process.env.ALCHEMY_ERC20_PAYMASTER_NONCE as string);
const chain = process.env.ALCHEMY_CHAIN;
const chainID = Number(process.env.ALCHEMY_CHAIN_ID);
const safeVersion = process.env.SAFE_VERSION as string;
const rpcURL = process.env.ALCHEMY_RPC_URL;
const policyID = process.env.ALCHEMY_GAS_POLICY;
const apiKey = process.env.ALCHEMY_API_KEY;
const erc20TokenAddress = process.env
  .ALCHEMY_ERC20_TOKEN_CONTRACT as `0x${string}`;
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
} else if (chain == "goerli") {
  publicClient = createPublicClient({
    transport: http(rpcURL),
    chain: goerli,
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

// Token Configurations
const erc20Decimals = await getERC20Decimals(erc20TokenAddress, publicClient);
const erc20Amount = BigInt(10 ** erc20Decimals);
let senderERC20Balance = await getERC20Balance(
  erc20TokenAddress,
  publicClient,
  senderAddress,
);
console.log(
  "\nSafe Wallet ERC20 Balance:",
  Number(senderERC20Balance / erc20Amount),
);

// Trying to mint tokens (Make sure ERC20 Token Contract is mintable by anyone).
if (senderERC20Balance < erc20Amount) {
  console.log("\nMinting ERC20 Tokens to Safe Wallet.");
  await mintERC20Token(
    erc20TokenAddress,
    publicClient,
    signer,
    senderAddress,
    erc20Amount,
    chain,
    paymaster,
  );

  while (senderERC20Balance < erc20Amount) {
    await setTimeout(15000);
    senderERC20Balance = await getERC20Balance(
      erc20TokenAddress,
      publicClient,
      senderAddress,
    );
  }
  console.log(
    "\nUpdated Safe Wallet ERC20 Balance:",
    Number(senderERC20Balance / erc20Amount),
  );
}

const newNonce = await getAccountNonce(publicClient, {
  entryPoint: entryPointAddress,
  sender: senderAddress,
});
console.log("\nNonce for the sender received from EntryPoint.");

const contractCode = await publicClient.getBytecode({ address: senderAddress });

if (contractCode) {
  console.log(
    "\nThe Safe is already deployed. Sending 1 ERC20 from the Safe to Signer.\n",
  );
} else {
  console.log(
    "\nDeploying a new Safe and transfering 1 ERC20 from Safe to Signer in one tx.\n",
  );
}

const sponsoredUserOperation: UserOperation = {
  sender: senderAddress,
  nonce: newNonce,
  initCode: contractCode ? "0x" : initCode,
  callData: encodeCallData({
    to: erc20TokenAddress,
    data: generateTransferCallData(signer.address, erc20Amount), // transfer() function call with corresponding data.
    value: 0n,
  }),
  callGasLimit: 0n, // All Gas Values will be filled by Paymaster Response Data
  verificationGasLimit: 0n,
  preVerificationGas: 0n,
  maxFeePerGas: 0n,
  maxPriorityFeePerGas: 0n,
  paymasterAndData: "0x",
  signature: "0x",
};

sponsoredUserOperation.signature = await signUserOperation(
  sponsoredUserOperation,
  signer,
  chainID,
  entryPointAddress,
);
console.log("\nSigned Dummy Data for Paymaster Data Creation from Alchemy.");

const gasOptions = {
  method: "POST",
  headers: { accept: "application/json", "content-type": "application/json" },
  body: JSON.stringify({
    id: 1,
    jsonrpc: "2.0",
    method: "alchemy_requestGasAndPaymasterAndData",
    params: [
      {
        policyId: policyID,
        entryPoint: entryPointAddress,
        dummySignature: sponsoredUserOperation.signature,
        userOperation: {
          sender: sponsoredUserOperation.sender,
          nonce: "0x" + sponsoredUserOperation.nonce.toString(16),
          initCode: sponsoredUserOperation.initCode,
          callData: sponsoredUserOperation.callData,
        },
      },
    ],
  }),
};

let responseValues;

await fetch("https://eth-" + chain + ".g.alchemy.com/v2/" + apiKey, gasOptions)
  .then((response) => response.json())
  .then((response) => (responseValues = response))
  .catch((err) => console.error(err));
console.log("\nReceived Paymaster Data from Alchemy.");

let rv;
if (responseValues && responseValues["result"]) {
  rv = responseValues["result"] as suoData;
}

sponsoredUserOperation.preVerificationGas = rv?.preVerificationGas;
sponsoredUserOperation.callGasLimit = rv?.callGasLimit;
sponsoredUserOperation.verificationGasLimit = rv?.verificationGasLimit;
sponsoredUserOperation.paymasterAndData = rv?.paymasterAndData;
sponsoredUserOperation.maxFeePerGas = rv?.maxFeePerGas;
sponsoredUserOperation.maxPriorityFeePerGas = rv?.maxPriorityFeePerGas;

sponsoredUserOperation.signature = await signUserOperation(
  sponsoredUserOperation,
  signer,
  chainID,
  entryPointAddress,
);
console.log("\nSigned Real Data including Paymaster Data Created by Alchemy.");

const options = {
  method: "POST",
  headers: { accept: "application/json", "content-type": "application/json" },
  body: JSON.stringify({
    id: 1,
    jsonrpc: "2.0",
    method: "eth_sendUserOperation",
    params: [
      {
        sender: sponsoredUserOperation.sender,
        nonce: "0x" + sponsoredUserOperation.nonce.toString(16),
        initCode: sponsoredUserOperation.initCode,
        callData: sponsoredUserOperation.callData,
        callGasLimit: sponsoredUserOperation.callGasLimit,
        verificationGasLimit: sponsoredUserOperation.verificationGasLimit,
        preVerificationGas: sponsoredUserOperation.preVerificationGas,
        maxFeePerGas: sponsoredUserOperation.maxFeePerGas,
        maxPriorityFeePerGas: sponsoredUserOperation.maxPriorityFeePerGas,
        signature: sponsoredUserOperation.signature,
        paymasterAndData: sponsoredUserOperation.paymasterAndData,
      },
      entryPointAddress,
    ],
  }),
};

await fetch("https://eth-" + chain + ".g.alchemy.com/v2/" + apiKey, options)
  .then((response) => response.json())
  .then((response) => (responseValues = response))
  .catch((err) => console.error(err));

if (responseValues && responseValues["result"]) {
  console.log("UserOperation submitted. Hash:", responseValues["result"]);
  console.log(
    "UserOp Link: https://jiffyscan.xyz/userOpHash/" +
      responseValues["result"] +
      "?network=" +
      chain,
  );

  const hashOptions = {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_getUserOperationReceipt",
      params: [responseValues["result"]],
      entryPoint: entryPointAddress,
    }),
  };
  let runOnce = true;

  while (responseValues["result"] == null || runOnce) {
    await setTimeout(25000);
    await fetch(
      "https://eth-" + chain + ".g.alchemy.com/v2/" + apiKey,
      hashOptions,
    )
      .then((response) => response.json())
      .then((response) => (responseValues = response))
      .catch((err) => console.error(err));
    runOnce = false;
  }

  if (
    responseValues["result"] &&
    responseValues["result"]["receipt"]["transactionHash"]
  ) {
    console.log(
      "\nTransaction Link: https://" +
        chain +
        ".etherscan.io/tx/" +
        responseValues["result"]["receipt"]["transactionHash"] +
        "\n",
    );
  } else {
    console.log("\n" + responseValues["error"]);
  }
} else {
  if (responseValues && responseValues["error"]["message"]) {
    console.log("\n" + responseValues["error"]["message"]);
  }
}
