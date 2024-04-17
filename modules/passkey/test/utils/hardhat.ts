import { ethers } from 'hardhat'

export const chainId = async (): Promise<bigint> => {
  return (await ethers.provider.getNetwork()).chainId
}
