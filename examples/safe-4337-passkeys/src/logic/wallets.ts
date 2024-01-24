import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react'
import { ethers } from 'ethers'
import { numberToUnpaddedHex } from '../utils'

const projectId = import.meta.env.VITE_WC_CLOUD_PROJECT_ID

const mumbai = {
  chainId: 80001,
  name: 'Polygon Mumbai',
  currency: 'MATIC',
  explorerUrl: 'https://mumbai.polygonscan.com',
  rpcUrl: 'https://rpc-mumbai.maticvigil.com',
}

const metadata = {
  name: 'Safe 4337 Passkeys Example',
  description: 'An example application to deploy a 4337-compatible Safe Account with Passkeys signer',
  url: 'https://safe.global',
  icons: ['https://app.safe.global/favicons/favicon.ico'],
}

createWeb3Modal({
  ethersConfig: defaultConfig({ metadata }),
  // defaultChain: mumbai,
  chains: [mumbai],
  projectId,
})

/**
 * Switches the Ethereum provider to the Mumbai network.
 * @param provider The Ethereum provider.
 * @returns A promise that resolves to an unknown value.
 */
async function switchToMumbai(provider: ethers.Eip1193Provider): Promise<unknown> {
  return provider
    .request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: numberToUnpaddedHex(mumbai.chainId),
          blockExplorerUrls: [mumbai.explorerUrl],
          chainName: mumbai.name,
          nativeCurrency: {
            name: mumbai.currency,
            symbol: mumbai.currency,
            decimals: 18,
          },
          rpcUrls: [mumbai.rpcUrl],
        },
      ],
    })
    .catch(() =>
      provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: numberToUnpaddedHex(mumbai.chainId) }],
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

export { switchToMumbai, getJsonRpcProviderFromEip1193Provider }
