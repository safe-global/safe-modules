import dotenv from "dotenv";
import type { Address } from "abitype"
import type { Hex, PrivateKeyAccount } from "viem"
import { EIP712_SAFE_OPERATION_TYPE, SAFE_ADDRESSES_MAP } from "./safe";

dotenv.config()
const ENTRY_POINT_ADDRESS = process.env.ALCHEMY_ENTRYPOINT_ADDRESS;
const chainID = Number(process.env.ALCHEMY_CHAIN_ID);
const safeVersion = process.env.SAFE_VERSION;

export type UserOperation = {
    sender: Address
    nonce: bigint
    initCode: Hex
    callData: Hex
    callGasLimit: bigint
    verificationGasLimit: bigint
    preVerificationGas: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
    paymasterAndData: Hex
    signature: Hex
}

export const signUserOperation = async (userOperation: UserOperation, signer: PrivateKeyAccount) => {
    const signatures = [
      {
        signer: signer.address,
        data: await signer.signTypedData({
          domain: {
            chainId: chainID,
            verifyingContract: SAFE_ADDRESSES_MAP[safeVersion][chainID].SAFE_4337_MODULE_ADDRESS,
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
      left.signer.toLowerCase().localeCompare(right.signer.toLowerCase())
    );
  
    let signatureBytes: Address = "0x";
    for (const sig of signatures) {
      signatureBytes += sig.data.slice(2);
    }
  
    return signatureBytes;
  };