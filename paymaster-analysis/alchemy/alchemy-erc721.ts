import dotenv from "dotenv";
import { getAccountNonce } from "permissionless";
import { UserOperation, signUserOperation } from "./utils/userOp";
import { Address, Hash, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { goerli, sepolia } from "viem/chains";
import {
  SAFE_ADDRESSES_MAP,
  encodeCallData,
  getAccountAddress,
  getAccountInitCode,
} from "./utils/safe";
import { generateMintingCallData } from "../utils/erc721";
import { setTimeout } from "timers/promises";

dotenv.config();
const privateKey = process.env.PRIVATE_KEY;
const ENTRY_POINT_ADDRESS = process.env.ALCHEMY_ENTRYPOINT_ADDRESS;
const multiSendAddress = process.env.ALCHEMY_MULTISEND_ADDRESS;
const saltNonce = BigInt(process.env.ALCHEMY_ERC721_PAYMASTER_NONCE);
const chain = process.env.ALCHEMY_CHAIN;
const chainID = Number(process.env.ALCHEMY_CHAIN_ID);
const safeVersion = process.env.SAFE_VERSION;
const rpcURL = process.env.ALCHEMY_RPC_URL;
const policyID = process.env.ALCHEMY_GAS_POLICY;
const apiKey = process.env.ALCHEMY_API_KEY;
const erc721TokenAddress = process.env.ALCHEMY_ERC721_TOKEN_CONTRACT;

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
    "Current code only support Sepolia and Goerli. Please make required changes if you want to use custom network.",
  );
}

// The console log in this function could be removed.
const initCode = await getAccountInitCode({
  owner: signer.address,
  addModuleLibAddress:
    SAFE_ADDRESSES_MAP[safeVersion][chainID].ADD_MODULES_LIB_ADDRESS,
  safe4337ModuleAddress:
    SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_4337_MODULE_ADDRESS,
  safeProxyFactoryAddress:
    SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_PROXY_FACTORY_ADDRESS,
  safeSingletonAddress:
    SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress,
});
console.log("\nInit Code Created.");

const senderAddress = await getAccountAddress({
  client: publicClient,
  owner: signer.address,
  addModuleLibAddress:
    SAFE_ADDRESSES_MAP[safeVersion][chainID].ADD_MODULES_LIB_ADDRESS,
  safe4337ModuleAddress:
    SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_4337_MODULE_ADDRESS,
  safeProxyFactoryAddress:
    SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_PROXY_FACTORY_ADDRESS,
  safeSingletonAddress:
    SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_SINGLETON_ADDRESS,
  saltNonce: saltNonce,
  multiSendAddress,
});
console.log("\nCounterfactual Sender Address Created:", senderAddress);
if (chain == "sepolia") {
  console.log(
    "Address Link: https://sepolia.etherscan.io/address/" + senderAddress,
  );
} else if (chain == "goerli") {
  console.log(
    "Address Link: https://goerli.etherscan.io/address/" + senderAddress,
  );
} else {
  throw new Error(
    "Current code only support Sepolia and Goerli. Please make required changes if you want to use custom network.",
  );
}

const newNonce = await getAccountNonce(publicClient, {
  entryPoint: ENTRY_POINT_ADDRESS,
  sender: senderAddress,
});
console.log("\nNonce for the sender received from EntryPoint.");

const contractCode = await publicClient.getBytecode({ address: senderAddress });

const sponsoredUserOperation: UserOperation = {
  sender: senderAddress,
  nonce: newNonce,
  initCode: contractCode ? "0x" : initCode,
  callData: encodeCallData({
    to: erc721TokenAddress,
    data: generateMintingCallData(signer.address), // safeMint() function call with corresponding data.
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
        entryPoint: ENTRY_POINT_ADDRESS,
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

if (chain == "sepolia") {
  await fetch("https://eth-sepolia.g.alchemy.com/v2/" + apiKey, gasOptions)
    .then((response) => response.json())
    .then((response) => (responseValues = response))
    .catch((err) => console.error(err));
} else if (chain == "goerli") {
  await fetch("https://eth-goerli.g.alchemy.com/v2/" + apiKey, gasOptions)
    .then((response) => response.json())
    .then((response) => (responseValues = response))
    .catch((err) => console.error(err));
} else {
  throw new Error(
    "Current code only support Sepolia and Goerli. Please make required changes if you want to use custom network.",
  );
}
console.log("\nReceived Paymaster Data from Alchemy.");

sponsoredUserOperation.preVerificationGas =
  responseValues.result.preVerificationGas;
sponsoredUserOperation.preVerificationGas =
  responseValues.result.preVerificationGas;
sponsoredUserOperation.callGasLimit = responseValues.result.callGasLimit;
sponsoredUserOperation.verificationGasLimit =
  responseValues.result.verificationGasLimit;
sponsoredUserOperation.paymasterAndData =
  responseValues.result.paymasterAndData;
sponsoredUserOperation.maxFeePerGas = responseValues.result.maxFeePerGas;
sponsoredUserOperation.maxPriorityFeePerGas =
  responseValues.result.maxPriorityFeePerGas;

sponsoredUserOperation.signature = await signUserOperation(
  sponsoredUserOperation,
  signer,
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
      ENTRY_POINT_ADDRESS,
    ],
  }),
};

if (chain == "sepolia") {
  await fetch("https://eth-sepolia.g.alchemy.com/v2/" + apiKey, options)
    .then((response) => response.json())
    .then((response) => (responseValues = response))
    .catch((err) => console.error(err));
} else if (chain == "goerli") {
  await fetch("https://eth-goerli.g.alchemy.com/v2/" + apiKey, options)
    .then((response) => response.json())
    .then((response) => (responseValues = response))
    .catch((err) => console.error(err));
} else {
  throw new Error(
    "Current code only support Sepolia and Goerli. Please make required changes if you want to use custom network.",
  );
}

if (responseValues.result) {
  console.log("\nSafe Account Creation User Operation Successfully Created!");
  console.log(
    "UserOp Link: https://jiffyscan.xyz/userOpHash/" +
      responseValues.result +
      "?network=" +
      chain +
      "\n",
  );

  const hashOptions = {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_getUserOperationReceipt",
      params: [responseValues.result],
      entryPoint: ENTRY_POINT_ADDRESS,
    }),
  };
  let runOnce = true;

  while (responseValues.result == null || runOnce) {
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

  if (responseValues.result) {
    console.log(
      "\nTransaction Link: https://" +
        chain +
        ".etherscan.io/tx/" +
        responseValues.result.receipt.transactionHash +
        "\n",
    );
  } else {
    console.log("\n" + responseValues.error);
  }
} else {
  console.log("\n" + responseValues.error.message);
}
