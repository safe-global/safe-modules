import { Address, encodeFunctionData } from 'viem'

export const generateMintingCallData = (to: Address) => {
  const transferData = encodeFunctionData({
    abi: [
      {
        inputs: [{ name: '_to', type: 'address' }],
        name: 'safeMint',
        outputs: [],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    args: [to],
  })

  return transferData
}
