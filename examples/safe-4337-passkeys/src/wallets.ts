import { createWeb3Modal, defaultConfig } from "@web3modal/ethers/react"

// 1. Get projectId at https://cloud.walletconnect.com
const projectId = import.meta.env.VITE_WC_CLOUD_PROJECT_ID

if (!projectId) {
  throw new Error("Walletconnect Project ID is missing")
}

// 2. Set chains
const mainnet = {
  chainId: 1,
  name: "Ethereum",
  currency: "ETH",
  explorerUrl: "https://etherscan.io",
  rpcUrl: "https://cloudflare-eth.com",
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
  chains: [mainnet],
  projectId,
})
