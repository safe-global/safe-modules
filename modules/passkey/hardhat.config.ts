import '@nomicfoundation/hardhat-toolbox'
import dotenv from 'dotenv'
import type { HardhatUserConfig } from 'hardhat/config'
import 'hardhat-deploy'
import { HttpNetworkUserConfig } from 'hardhat/types'
import './src/tasks/codesize'

dotenv.config()
const { CUSTOM_NODE_URL, MNEMONIC, ETHERSCAN_API_KEY, PK } = process.env

const DEFAULT_MNEMONIC = 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'

const sharedNetworkConfig: HttpNetworkUserConfig = {}
if (PK) {
  sharedNetworkConfig.accounts = [PK]
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  }
}

const customNetwork = CUSTOM_NODE_URL
  ? {
      custom: {
        ...sharedNetworkConfig,
        url: CUSTOM_NODE_URL,
      },
    }
  : {}

const config: HardhatUserConfig = {
  paths: {
    artifacts: 'build/artifacts',
    cache: 'build/cache',
    deploy: 'src/deploy',
    sources: 'contracts',
  },
  networks: {
    localhost: {
      url: 'http://localhost:8545',
      tags: ['dev', 'entrypoint', 'safe'],
    },
    hardhat: {
      tags: ['test', 'entrypoint', 'safe'],
    },
    sepolia: {
      ...sharedNetworkConfig,
      url: 'https://rpc.ankr.com/eth_sepolia',
      tags: ['dev'],
    },
    ...customNetwork,
  },
  solidity: {
    compilers: [
      {
        version: '0.8.24',
        settings: {
          optimizer: {
            enabled: true,
            runs: 10_000_000,
          },
          viaIR: false,
          evmVersion: 'paris',
        },
      },
    ],
  },
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
}

export default config
