import dotenv from "dotenv";
import type { Address } from "abitype";
import type { Hex, PrivateKeyAccount } from "viem";
import { EIP712_SAFE_OPERATION_TYPE, SAFE_ADDRESSES_MAP } from "./safe";

dotenv.config();
const safeVersion = process.env.SAFE_VERSION;

export type UserOperation = {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
};

export type suoData = {
  preVerificationGas: any;
  callGasLimit: any;
  verificationGasLimit: any;
  paymasterAndData: any;
  maxFeePerGas: any;
  maxPriorityFeePerGas: any;
};

export const submitUserOperation = async (
  userOperation: UserOperation,
  bundlerClient: any,
  entryPointAddress: any,
  chain: string,
) => {
  const userOperationHash = await bundlerClient.sendUserOperation({
    userOperation,
    entryPoint: entryPointAddress,
  });
  console.log(`UserOperation submitted. Hash: ${userOperationHash}`);
  console.log(
    `UserOp Link: https://jiffyscan.xyz/userOpHash/${userOperationHash}?network=` +
      chain +
      "\n",
  );

  console.log("Querying for receipts...");
  const receipt = await bundlerClient.waitForUserOperationReceipt({
    hash: userOperationHash,
  });
  console.log(
    `Receipt found!\nTransaction hash: ${receipt.receipt.transactionHash}`,
  );
  console.log(
    `Transaction Link: https://` +
      chain +
      `.etherscan.io/tx/${receipt.receipt.transactionHash}`,
  );
};

export const signUserOperation = async (
  userOperation: UserOperation,
  signer: PrivateKeyAccount,
  chainID: any,
  entryPointAddress: any,
) => {
  const signatures = [
    {
      signer: signer.address,
      data: await signer.signTypedData({
        domain: {
          chainId: chainID,
          verifyingContract:
            SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_4337_MODULE_ADDRESS,
        },
        types: EIP712_SAFE_OPERATION_TYPE,
        primaryType: "SafeOp",
        message: {
          safe: userOperation.sender,
          callData: userOperation.callData,
          nonce: userOperation.nonce,
          preVerificationGas: userOperation.preVerificationGas,
          verificationGasLimit: userOperation.verificationGasLimit,
          callGasLimit: userOperation.callGasLimit,
          maxFeePerGas: userOperation.maxFeePerGas,
          maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
          entryPoint: entryPointAddress,
        },
      }),
    },
  ];

  signatures.sort((left, right) =>
    left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()),
  );

  let signatureBytes: Address = "0x";
  for (const sig of signatures) {
    signatureBytes += sig.data.slice(2);
  }

  return signatureBytes;
};
