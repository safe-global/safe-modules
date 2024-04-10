import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react'
import { ethers } from 'ethers'
import { numberToUnpaddedHex } from '../utils'

const projectId = import.meta.env.VITE_WC_CLOUD_PROJECT_ID

const sepolia = {
  chainId: 11155111,
  name: 'Sepolia test network',
  currency: 'ETH',
  explorerUrl: 'https://sepolia.etherscan.io',
  rpcUrl: 'https://sepolia.gateway.tenderly.co',
}

const metadata = {
  name: 'Safe 4337 Passkeys Example',
  description: 'An example application to deploy a 4337-compatible Safe Account with Passkeys signer',
  url: 'https://safe.global',
  icons: ['https://app.safe.global/favicons/favicon.ico'],
}

createWeb3Modal({
  ethersConfig: defaultConfig({ metadata }),
  chains: [sepolia],
  projectId,
})

/**
 * Switches the Ethereum provider to the Ethereum Sepolia test network.
 * @param provider The Ethereum provider.
 * @returns A promise that resolves to an unknown value.
 */
async function switchToSepolia(provider: ethers.Eip1193Provider): Promise<unknown> {
  return provider
    .request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: numberToUnpaddedHex(sepolia.chainId),
          blockExplorerUrls: [sepolia.explorerUrl],
          chainName: sepolia.name,
          nativeCurrency: {
            name: sepolia.currency,
            symbol: sepolia.currency,
            decimals: 18,
          },
          rpcUrls: [sepolia.rpcUrl],
        },
      ],
    })
    .catch(() =>
      provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: numberToUnpaddedHex(sepolia.chainId) }],
      }),
    )
}

/**
 * Converts an Eip1193Provider to a JsonRpcApiProvider.
 * @param provider The Eip1193Provider to convert.
 * @returns The converted JsonRpcApiProvider.
 */
function getJsonRpcProviderFromEip1193Provider(provider: ethers.Eip1193Provider): ethers.JsonRpcApiProvider {
  return new ethers.BrowserProvider(provider)
}

export { switchToSepolia, getJsonRpcProviderFromEip1193Provider }
