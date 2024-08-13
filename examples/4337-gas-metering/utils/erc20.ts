import dotenv from 'dotenv'
import { Address, Chain, PrivateKeyAccount, PublicClient, Transport, createWalletClient, encodeFunctionData, http } from 'viem'
import {
  ERC20_TOKEN_APPROVE_ABI,
  ERC20_TOKEN_BALANCE_OF_ABI,
  ERC20_TOKEN_DECIMALS_ABI,
  ERC20_TOKEN_MINT_ABI,
  ERC20_TOKEN_TRANSFER_ABI,
} from './abi'

dotenv.config()
const pimlicoRPCURL = process.env.PIMLICO_RPC_URL
const alchemyRPCURL = process.env.ALCHEMY_RPC_URL
const gelatoRPCURL = process.env.GELATO_RPC_URL

export const generateApproveCallData = (paymasterAddress: Address) => {
  const approveData = encodeFunctionData({
    abi: ERC20_TOKEN_APPROVE_ABI,
    args: [paymasterAddress, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn],
  })

  return approveData
}

export const generateTransferCallData = (to: Address, value: bigint) => {
  const transferData = encodeFunctionData({
    abi: ERC20_TOKEN_TRANSFER_ABI,
    args: [to, value],
  })

  return transferData
}

export const getERC20Decimals = async <C extends Chain>(
  erc20TokenAddress: Address,
  publicClient: PublicClient<Transport<'http'>, C>,
): Promise<number> => {
  const erc20Decimals = await publicClient.readContract({
    abi: ERC20_TOKEN_DECIMALS_ABI,
    address: erc20TokenAddress,
    functionName: 'decimals',
  })

  return erc20Decimals
}

export const getERC20Balance = async <C extends Chain>(
  erc20TokenAddress: Address,
  publicClient: PublicClient<Transport<'http'>, C>,
  owner: Address,
): Promise<bigint> => {
  const senderERC20Balance = await publicClient.readContract({
    abi: ERC20_TOKEN_BALANCE_OF_ABI,
    address: erc20TokenAddress,
    functionName: 'balanceOf',
    args: [owner],
  })

  return senderERC20Balance
}

export const mintERC20Token = async <C extends Chain>(
  erc20TokenAddress: Address,
  publicClient: PublicClient<Transport<'http'>, C>,
  signer: PrivateKeyAccount,
  to: Address,
  amount: bigint,
  paymaster: string,
) => {
  const walletClient = createWalletClient({
    account: signer,
    chain: publicClient.chain,
    transport: getTransport(paymaster),
  })

  const { request } = await publicClient.simulateContract({
    address: erc20TokenAddress,
    abi: ERC20_TOKEN_MINT_ABI,
    functionName: 'mint',
    args: [to, amount],
    account: signer,
  })

  // I cannot get Viem to accept the `request` type here, and it seems to be related to this
  // function being generic on the chain type. Using concrete chain types helps, but doesn't
  // completely solve the issue either.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await walletClient.writeContract(request as any)
}

export const transferERC20Token = async <C extends Chain>(
  erc20TokenAddress: Address,
  publicClient: PublicClient<Transport<'http'>, C>,
  signer: PrivateKeyAccount,
  to: Address,
  amount: bigint,
  paymaster: string,
) => {
  const walletClient = createWalletClient({
    account: signer,
    chain: publicClient.chain,
    transport: getTransport(paymaster),
  })

  const signerERC20Bal = await getERC20Balance(erc20TokenAddress, publicClient, signer.address)
  if (signerERC20Bal < amount) {
    console.log('Signer does not have enough Tokens to transfer. Please transfer required funds.')
    process.exit(0)
  }

  const { request } = await publicClient.simulateContract({
    address: erc20TokenAddress,
    abi: ERC20_TOKEN_TRANSFER_ABI,
    functionName: 'transfer',
    args: [to, amount],
    account: signer,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await walletClient.writeContract(request as any)
}

const getTransport = (paymaster: string): Transport<'http'> => {
  switch (paymaster) {
    case 'pimlico':
      return http(pimlicoRPCURL)
    case 'alchemy':
      return http(alchemyRPCURL)
    case 'gelato':
      return http(gelatoRPCURL)
    default:
      throw new Error(
        'Current code only support Alchemy, Pimlico and Gelato. Please make required changes if you want to use a different Paymaster.',
      )
  }
}
