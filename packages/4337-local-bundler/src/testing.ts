import { MultiProvider4337, UserOperation } from '@safe-global/safe-4337-provider'
import { HDNodeWallet } from 'ethers'
import { deployments, ethers } from 'hardhat'

export const BUNDLER_URL = process.env.TEST_BUNLDER_URL || 'http://localhost:3000/rpc'
export const BUNDLER_MNEMONIC = process.env.TEST_BUNDLER_MNEMONIC || 'test test test test test test test test test test test junk'

export type PrepareAccountOptions = {
  mnemonic: string
  count: number
}

export async function prepareAccounts(options: Partial<PrepareAccountOptions> = {}): Promise<HDNodeWallet[]> {
  const { mnemonic, count } = {
    mnemonic: BUNDLER_MNEMONIC,
    count: 1,
    ...options,
  }

  const bundler = ethers.HDNodeWallet.fromPhrase(mnemonic).connect(ethers.provider)
  const accounts = [...Array(count)].map(() => ethers.Wallet.createRandom(ethers.provider))

  const [deployer] = await ethers.getSigners()
  const fund = ethers.parseEther('1.337')
  for (const account of [bundler, ...accounts]) {
    const balance = await ethers.provider.getBalance(account.address)
    if (balance < fund) {
      const transaction = await deployer.sendTransaction({ to: account.address, value: fund })
      await transaction.wait()
    }
  }

  return accounts
}

export function bundlerRpc(url = BUNDLER_URL) {
  return new MultiProvider4337(url, ethers.provider)
}

export async function waitForUserOp({ sender, nonce }: Pick<UserOperation, 'sender' | 'nonce'>, timeout = 10_000) {
  const { address: entryPointAddress } = await deployments.get('EntryPoint')
  const entryPoint = await ethers.getContractAt('INonceManager', entryPointAddress)
  const start = performance.now()
  const key = BigInt(nonce) >> 64n
  while ((await entryPoint.getNonce(sender, key)) <= BigInt(nonce)) {
    if (performance.now() - start > timeout) {
      throw new Error(`timeout waiting for user operation execution`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}
