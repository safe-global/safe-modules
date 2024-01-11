import { createWeb3Modal, defaultConfig } from "@web3modal/ethers/react"
import { ethers } from "ethers"
import { numberToUnpaddedHex } from "../utils"

// 1. Get projectId at https://cloud.walletconnect.com
const projectId = import.meta.env.VITE_WC_CLOUD_PROJECT_ID

if (!projectId) {
  throw new Error("Walletconnect Project ID is missing")
}

// 2. Set chains
const mumbai = {
  chainId: 80001,
  name: "Polygon Mumbai",
  currency: "MATIC",
  explorerUrl: "https://mumbai.polygonscan.com",
  rpcUrl: "https://rpc-mumbai.maticvigil.com",
}

// 3. Create modal
const metadata = {
  name: "Safe 4337 Passkeys Example",
  description:
    "An example application to deploy a 4337-compatible Safe Account with Passkeys signer",
  url: "https://safe.global",
  icons: ["https://app.safe.global/favicons/favicon.ico"],
}

createWeb3Modal({
  ethersConfig: defaultConfig({ metadata }),
  // defaultChain: mumbai,
  chains: [mumbai],
  projectId,
})

async function switchToMumbai(provider: ethers.Eip1193Provider) {
  return provider
    .request({
      method: "wallet_addEthereumChain",
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
        method: "wallet_switchEthereumChain",
        params: [{ chainId: numberToUnpaddedHex(mumbai.chainId) }],
      })
    )
}

export { switchToMumbai }
