import dotenv from 'dotenv'
import { http, Address, encodeFunctionData, createWalletClient, PrivateKeyAccount, PublicClient } from 'viem'
import { baseSepolia, goerli, polygonMumbai, sepolia } from 'viem/chains'
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

export const getERC20Decimals = async (erc20TokenAddress: Address, publicClient: PublicClient): Promise<bigint> => {
  const erc20Decimals = (await publicClient.readContract({
    abi: ERC20_TOKEN_DECIMALS_ABI,
    address: erc20TokenAddress,
    functionName: 'decimals',
  })) as bigint

  return erc20Decimals
}

export const getERC20Balance = async (erc20TokenAddress: Address, publicClient: PublicClient, owner: Address): Promise<bigint> => {
  const senderERC20Balance = (await publicClient.readContract({
    abi: ERC20_TOKEN_BALANCE_OF_ABI,
    address: erc20TokenAddress,
    functionName: 'balanceOf',
    args: [owner],
  })) as bigint

  return senderERC20Balance
}

export const mintERC20Token = async (
  erc20TokenAddress: Address,
  publicClient: PublicClient,
  signer: PrivateKeyAccount,
  to: Address,
  amount: bigint,
  chain: string,
  paymaster: string,
) => {
  let walletClient
  if (paymaster == 'pimlico') {
    if (chain == 'goerli') {
      walletClient = createWalletClient({
        account: signer,
        chain: goerli,
        transport: http(pimlicoRPCURL),
      })
    } else if (chain == 'mumbai') {
      walletClient = createWalletClient({
        account: signer,
        chain: polygonMumbai,
        transport: http(pimlicoRPCURL),
      })
    } else if (chain == 'base-sepolia') {
      walletClient = createWalletClient({
        account: signer,
        chain: baseSepolia,
        transport: http(pimlicoRPCURL),
      })
    } else {
      throw new Error('Current code only support limited networks. Please make required changes if you want to use custom network.')
    }
  } else if (paymaster == 'alchemy') {
    if (chain == 'sepolia') {
      walletClient = createWalletClient({
        account: signer,
        chain: sepolia,
        transport: http(alchemyRPCURL),
      })
    } else if (chain == 'goerli') {
      walletClient = createWalletClient({
        account: signer,
        chain: goerli,
        transport: http(alchemyRPCURL),
      })
    } else {
      throw new Error('Current code only support limited networks. Please make required changes if you want to use custom network.')
    }
  } else if (paymaster == 'gelato') {
    if (chain == 'sepolia') {
      walletClient = createWalletClient({
        account: signer,
        chain: sepolia,
        transport: http(gelatoRPCURL),
      })
    } else if (chain == 'base-sepolia') {
      walletClient = createWalletClient({
        account: signer,
        chain: baseSepolia,
        transport: http(gelatoRPCURL),
      })
    } else {
      throw new Error('Current code only support limited networks. Please make required changes if you want to use custom network.')
    }
  } else {
    throw new Error('Current code only support Pimlico and Alchemy. Please make required changes if you want to use a different Paymaster.')
  }
  const { request } = await publicClient.simulateContract({
    address: erc20TokenAddress,
    abi: ERC20_TOKEN_MINT_ABI,
    functionName: 'mint',
    args: [to, amount],
    account: signer,
  })
  await walletClient.writeContract(request)
}

export const transferERC20Token = async (
  erc20TokenAddress: Address,
  publicClient: PublicClient,
  signer: PrivateKeyAccount,
  to: Address,
  amount: bigint,
  chain: string,
  paymaster: string,
) => {
  let walletClient
  if (paymaster == 'pimlico') {
    if (chain == 'goerli') {
      walletClient = createWalletClient({
        account: signer,
        chain: goerli,
        transport: http(pimlicoRPCURL),
      })
    } else if (chain == 'mumbai') {
      walletClient = createWalletClient({
        account: signer,
        chain: polygonMumbai,
        transport: http(pimlicoRPCURL),
      })
    } else {
      throw new Error('Current code only support limited networks. Please make required changes if you want to use custom network.')
    }
  } else if (paymaster == 'alchemy') {
    if (chain == 'sepolia') {
      walletClient = createWalletClient({
        account: signer,
        chain: sepolia,
        transport: http(alchemyRPCURL),
      })
    } else if (chain == 'goerli') {
      walletClient = createWalletClient({
        account: signer,
        chain: goerli,
        transport: http(alchemyRPCURL),
      })
    } else {
      throw new Error('Current code only support limited networks. Please make required changes if you want to use custom network.')
    }
  } else if (paymaster == 'gelato') {
    if (chain == 'sepolia') {
      walletClient = createWalletClient({
        account: signer,
        chain: sepolia,
        transport: http(gelatoRPCURL),
      })
    } else if (chain == 'base-sepolia') {
      walletClient = createWalletClient({
        account: signer,
        chain: baseSepolia,
        transport: http(gelatoRPCURL),
      })
    } else {
      throw new Error('Current code only support limited networks. Please make required changes if you want to use custom network.')
    }
  } else {
    throw new Error('Current code only support Pimlico and Alchemy. Please make required changes if you want to use a different Paymaster.')
  }

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
  await walletClient.writeContract(request)
}
