import dotenv from 'dotenv'
import { http, createWalletClient, PrivateKeyAccount } from 'viem'
import { goerli, polygonMumbai, sepolia } from 'viem/chains'
import { setTimeout } from 'timers/promises'

dotenv.config()
const pimlicoRPCURL = process.env.PIMLICO_RPC_URL
const alchemyRPCURL = process.env.ALCHEMY_RPC_URL
const gelatoRPCURL = process.env.GELATO_RPC_URL

export const transferETH = async (
  publicClient: any,
  signer: PrivateKeyAccount,
  receiver: `0x${string}`,
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
      throw new Error(
        'For Pimlico, current code only support using Goerli. Please make required changes if you want to use custom network.',
      )
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
    } else {
      throw new Error('Current code only support limited networks. Please make required changes if you want to use custom network.')
    }
  } else {
    throw new Error(
      'Current code only support Pimlico, Alchemy and Gelato. Please make required changes if you want to use a different Paymaster.',
    )
  }

  let userETHBalance = await publicClient.getBalance({
    address: signer.address,
  })

  if (userETHBalance < amount) {
    console.log('\nSigner does not have enough balance to deposit to Safe. Deposit atleast', amount, 'wei.')
    while (userETHBalance < amount) {
      await setTimeout(15000)
      userETHBalance = await publicClient.getBalance({
        address: signer.address,
      })
    }
    console.log('\nSigner now have enough balance for depositing ETH to Safe Transfer.')
  }

  await walletClient.sendTransaction({
    to: receiver,
    value: amount,
  })
}
