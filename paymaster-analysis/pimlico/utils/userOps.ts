import dotenv from "dotenv";
import type { Address } from "abitype";
import type { PrivateKeyAccount } from "viem";
import { EIP712_SAFE_OPERATION_TYPE, SAFE_ADDRESSES_MAP } from "./safe";
import {
  UserOperation,
} from "permissionless";

dotenv.config();
const ENTRY_POINT_ADDRESS = process.env.PIMLICO_ENTRYPOINT_ADDRESS;
const chain = process.env.PIMLICO_CHAIN;
const chainID = Number(process.env.PIMLICO_CHAIN_ID);
const safeVersion = process.env.SAFE_VERSION;

export const submitUserOperation = async (
  userOperation: UserOperation,
  bundlerClient: any,
) => {
  const userOperationHash = await bundlerClient.sendUserOperation({
    userOperation,
    entryPoint: ENTRY_POINT_ADDRESS,
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
          entryPoint: ENTRY_POINT_ADDRESS,
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
