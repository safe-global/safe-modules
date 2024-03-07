import { ethers } from 'hardhat'

export async function chainId(): Promise<bigint> {
  return (await ethers.provider.getNetwork()).chainId
}
