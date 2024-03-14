import { ethers } from 'ethers'
import { getRandomUint256 } from '../utils'

/**
 * Encodes the data for a safe mint operation.
 * @param to The address to mint the token to.
 * @param tokenId The ID of the token to mint.
 * @returns The encoded data for the safe mint operation.
 */
function encodeSafeMintData(to: string, tokenId: ethers.BigNumberish = getRandomUint256()): string {
  const abi = ['function safeMint(address to, uint256 tokenId) external']
  return new ethers.Interface(abi).encodeFunctionData('safeMint', [to, tokenId])
}

export { encodeSafeMintData }
