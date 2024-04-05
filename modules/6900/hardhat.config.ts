import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-deploy'
import dotenv from 'dotenv'
import type { HardhatUserConfig, HttpNetworkUserConfig } from 'hardhat/types'
import yargs from 'yargs/yargs'

const argv = yargs(process.argv.slice(2))
  .options({ network: { type: 'string', default: 'hardhat' } })
  .help(false)
  .version(false)
  .parseSync()

// Load environment variables.
dotenv.config()
const { NODE_URL, INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, PK, SOLIDITY_VERSION, SOLIDITY_SETTINGS } = process.env

const DEFAULT_MNEMONIC = 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'

const sharedNetworkConfig: HttpNetworkUserConfig = {}
if (PK) {
  sharedNetworkConfig.accounts = [PK]
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  }
}

if (['mainnet', 'sepolia', 'polygon', 'amoy'].includes(argv.network) && INFURA_KEY === undefined) {
  throw new Error(`Could not find Infura key in env, unable to connect to network ${argv.network}`)
}

import './src/tasks/local_verify'
import './src/tasks/deploy_contracts'
import './src/tasks/show_codesize'

const solidityVersion = SOLIDITY_VERSION || '0.8.23'
const soliditySettings = SOLIDITY_SETTINGS
  ? JSON.parse(SOLIDITY_SETTINGS)
  : {
      evmVersion: 'paris',
      optimizer: {
        enabled: true,
        runs: 10_000_000,
      },
    }

const customNetwork = NODE_URL
  ? {
      custom: {
        ...sharedNetworkConfig,
        url: NODE_URL,
      },
    }
  : {}

const userConfig: HardhatUserConfig = {
  paths: {
    artifacts: 'build/artifacts',
    cache: 'build/cache',
    deploy: 'src/deploy',
    sources: 'contracts',
  },
  solidity: {
    version: solidityVersion,
    settings: soliditySettings,
  },
  networks: {
    localhost: {
      url: 'http://localhost:8545',
      tags: ['dev', 'entrypoint', 'safe'],
    },
    hardhat: {
      gasPrice: 10000000000,
      tags: ['test', 'entrypoint', 'safe'],
    },
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    },
    gnosis: {
      ...sharedNetworkConfig,
      url: 'https://rpc.gnosis.gateway.fm',
    },
    polygon: {
      ...sharedNetworkConfig,
      url: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
    },
    sepolia: {
      ...sharedNetworkConfig,
      url: `https://sepolia.infura.io/v3/${INFURA_KEY}`,
      tags: ['dev', 'entrypoint'],
    },
    amoy: {
      ...sharedNetworkConfig,
      url: `https://polygon-amoy.infura.io/v3/${INFURA_KEY}`,
      tags: ['dev', 'entrypoint'],
    },
    ...customNetwork,
  },
  namedAccounts: {
    deployer: 0,
  },
  mocha: {
    timeout: 2000000,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
}
export default userConfig
