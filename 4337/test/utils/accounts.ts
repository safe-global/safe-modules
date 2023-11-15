import { ethers } from "hardhat";

export interface TestAccountOptions {
  fund: bigint,
  count: number,
}

export async function makeAccounts({ count, fund }: TestAccountOptions) {
  const accounts = [...Array(count)].map(() => ethers.Wallet.createRandom(ethers.provider))
  if (fund > 0n) {
    const [deployer] = await ethers.getSigners();
    for (const account of accounts) {
      const transaction = await deployer.sendTransaction({ to: account.address, value: fund })
      await transaction.wait();
    }
  }

  return accounts;
}