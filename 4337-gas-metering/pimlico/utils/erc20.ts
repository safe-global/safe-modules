import dotenv from "dotenv";
import {
  http,
  Address,
  encodeFunctionData,
  createWalletClient,
  PrivateKeyAccount,
} from "viem";
import { goerli, sepolia } from "viem/chains";

dotenv.config();
const rpcURL = process.env.PIMLICO_RPC_URL;
const chain = process.env.PIMLICO_CHAIN;

export const generateApproveCallData = (paymasterAddress: Address) => {
  const approveData = encodeFunctionData({
    abi: [
      {
        inputs: [
          { name: "_spender", type: "address" },
          { name: "_value", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    args: [
      paymasterAddress,
      0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
    ],
  });

  return approveData;
};

export const generateTransferCallData = (to: Address, value: bigint) => {
  const transferData = encodeFunctionData({
    abi: [
      {
        inputs: [
          { name: "_to", type: "address" },
          { name: "_value", type: "uint256" },
        ],
        name: "transfer",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    args: [to, value],
  });

  return transferData;
};

export const getERC20Decimals = async (
  erc20TokenAddress: string,
  publicClient: any,
) => {
  const erc20Decimals = await publicClient.readContract({
    abi: [
      {
        inputs: [],
        name: "decimals",
        outputs: [{ type: "uint8" }],
        type: "function",
        stateMutability: "view",
      },
    ],
    address: erc20TokenAddress,
    functionName: "decimals",
  });

  return erc20Decimals;
};

export const getERC20Balance = async (
  erc20TokenAddress: string,
  publicClient: any,
  owner: string,
) => {
  const senderERC20Balance = await publicClient.readContract({
    abi: [
      {
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        type: "function",
        stateMutability: "view",
      },
    ],
    address: erc20TokenAddress,
    functionName: "balanceOf",
    args: [owner],
  });

  return senderERC20Balance;
};

export const mintERC20Token = async (
  erc20TokenAddress: string,
  publicClient: any,
  signer: PrivateKeyAccount,
  to: string,
  amount: number,
) => {
  let walletClient;
  if (chain == "sepolia") {
    walletClient = createWalletClient({
      account: signer,
      chain: sepolia,
      transport: http(rpcURL),
    });
  } else if (chain == "goerli") {
    walletClient = createWalletClient({
      account: signer,
      chain: goerli,
      transport: http(rpcURL),
    });
  } else {
    throw new Error(
      "Current code only support Sepolia and Goerli. Please make required changes if you want to use custom network.",
    );
  }
  const { request } = await publicClient.simulateContract({
    address: erc20TokenAddress,
    abi: [
      {
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        name: "mint",
        outputs: [],
        type: "function",
        stateMutability: "public",
      },
    ],
    functionName: "mint",
    args: [to, amount],
    signer,
  });
  await walletClient.writeContract(request);
};
