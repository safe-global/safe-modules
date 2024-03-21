import { ethers, AddressLike, BigNumberish, BytesLike, Provider, JsonRpcProvider } from 'ethers'

export interface RpcProvider extends Provider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(method: string, params: unknown[]): Promise<any>
}

export type UserOperation = {
  sender: string
  nonce: BigNumberish
  factory?: string
  factoryData?: BytesLike
  callData: BytesLike
  callGasLimit: BigNumberish
  verificationGasLimit: BigNumberish
  preVerificationGas: BigNumberish
  maxFeePerGas: BigNumberish
  maxPriorityFeePerGas: BigNumberish
  paymaster?: string
  paymasterVerificationGasLimit?: BigNumberish
  paymasterPostOpGasLimit?: BigNumberish
  paymasterData?: BytesLike
  signature: BytesLike
}

export class MultiProvider4337 extends JsonRpcProvider {
  generalProvider: RpcProvider
  constructor(aaProviderUrl: string, generalProvider: RpcProvider) {
    super(aaProviderUrl)
    this.generalProvider = generalProvider
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(method: string, params: unknown[]): Promise<any> {
    if (
      [
        'eth_supportedEntryPoints',
        'eth_estimateUserOperationGas',
        'eth_sendUserOperation',
        'eth_getUserOperationByHash',
        'eth_getUserOperationReceipt',
      ].indexOf(method) >= 0
    ) {
      return super.send(method, params)
    } else {
      return this.generalProvider.send(method, params)
    }
  }

  public async sendUserOperation(userOp: UserOperation, entryPoint: AddressLike): Promise<string> {
    const jsonUserOp = {
      sender: ethers.getAddress(userOp.sender),
      nonce: ethers.toBeHex(userOp.nonce),
      callData: ethers.hexlify(userOp.callData),
      callGasLimit: ethers.toBeHex(userOp.callGasLimit),
      verificationGasLimit: ethers.toBeHex(userOp.verificationGasLimit),
      preVerificationGas: ethers.toBeHex(userOp.preVerificationGas),
      maxFeePerGas: ethers.toBeHex(userOp.maxFeePerGas),
      maxPriorityFeePerGas: ethers.toBeHex(userOp.maxPriorityFeePerGas),
      signature: ethers.hexlify(userOp.signature),
    } as Record<string, unknown>
    if (userOp.factory) {
      jsonUserOp.factory = ethers.getAddress(userOp.factory)
      jsonUserOp.factoryData = ethers.hexlify(userOp.factoryData!)
    }
    if (userOp.paymaster) {
      jsonUserOp.paymaster = ethers.getAddress(userOp.paymaster)
      jsonUserOp.paymasterVerificationGasLimit = ethers.toBeHex(userOp.paymasterVerificationGasLimit!)
      jsonUserOp.paymasterPostOpGasLimit = ethers.toBeHex(userOp.paymasterPostOpGasLimit!)
      jsonUserOp.paymasterData = ethers.hexlify(userOp.paymasterData!)
    }
    return await super.send('eth_sendUserOperation', [jsonUserOp, await ethers.resolveAddress(entryPoint, this)])
  }
}
