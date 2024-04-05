import type { LogDescription, TransactionReceipt } from 'ethers'

declare module 'ethers' {
  interface ContractTransactionResponse {
    wait(): Promise<TransactionReceipt>
  }

  interface TransactionResponse {
    wait(): Promise<TransactionReceipt>
  }

  interface Interface {
    parseLog(log: { topics: ReadonlyArray<string>; data: string }): null | LogDescription
  }
}
