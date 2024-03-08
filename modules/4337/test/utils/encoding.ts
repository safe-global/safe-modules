import { AddressLike, BigNumberish, BytesLike } from 'ethers'
import { ethers } from 'hardhat'

export const Erc20 = [
  'function transfer(address _receiver, uint256 _value) public returns (bool success)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address _owner, address _spender) public view returns (uint256 remaining)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'event Approval(address indexed _owner, address indexed _spender, uint256 _value)',
]

export const Erc20Interface = new ethers.Interface(Erc20)

export const encodeTransfer = (target: string, amount: string | number): string => {
  return Erc20Interface.encodeFunctionData('transfer', [target, amount])
}

export const chainId = async () => {
  return (await ethers.provider.getNetwork()).chainId
}

export const timestamp = async () => {
  const block = await ethers.provider.getBlock('latest')
  if (block === null) {
    throw new Error('missing latest block???')
  }
  return block.timestamp
}

export interface MultiSendTransaction {
  op: 0 | 1
  to: AddressLike
  value?: BigNumberish
  data: BytesLike
}

export function encodeMultiSendTransactions(transactions: MultiSendTransaction[]) {
  return ethers.concat(
    transactions.map(({ op, to, value, data }) =>
      ethers.solidityPacked(['uint8', 'address', 'uint256', 'uint256', 'bytes'], [op, to, value ?? 0, ethers.dataLength(data), data]),
    ),
  )
}
