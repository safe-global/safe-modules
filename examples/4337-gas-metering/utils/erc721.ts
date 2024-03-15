import { Address, encodeFunctionData } from 'viem'
import { ERC721_TOKEN_SAFEMINT_ABI } from './abi'

export const generateMintingCallData = (to: Address) => {
  const transferData = encodeFunctionData({
    abi: ERC721_TOKEN_SAFEMINT_ABI,
    args: [to],
  })

  return transferData
}
