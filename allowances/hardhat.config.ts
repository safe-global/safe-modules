import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-gas-reporter'
import 'hardhat-deploy'

import dotenv from 'dotenv'
import { HardhatUserConfig, HttpNetworkUserConfig } from 'hardhat/types'

dotenv.config()
const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY } = process.env
const DEFAULT_MNEMONIC =
  'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'

const sharedNetworkConfig: HttpNetworkUserConfig = {
  accounts: {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  },
}

let config: HardhatUserConfig = {
  paths: {
    artifacts: 'build/artifacts',
    cache: 'build/cache',
    deploy: 'src/deploy',
    sources: 'contracts',
  },
  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 100000000,
      gas: 100000000,
    },
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    },
    gnosis: {
      ...sharedNetworkConfig,
      url: 'https://rpc.gnosischain.com',
    },
    ewc: {
      ...sharedNetworkConfig,
      url: `https://rpc.energyweb.org`,
    },
    goerli: {
      ...sharedNetworkConfig,
      url: `https://goerli.infura.io/v3/${INFURA_KEY}`,
    },
    mumbai: {
      ...sharedNetworkConfig,
      url: `https://polygon-mumbai.infura.io/v3/${INFURA_KEY}`,
    },
    polygon: {
      ...sharedNetworkConfig,
      url: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
    },
    volta: {
      ...sharedNetworkConfig,
      url: `https://volta-rpc.energyweb.org`,
    },
    bsc: {
      ...sharedNetworkConfig,
      url: `https://bsc-dataseed.binance.org/`,
    },
    arbitrum: {
      ...sharedNetworkConfig,
      url: `https://arb1.arbitrum.io/rpc`,
    },
    fantomTestnet: {
      ...sharedNetworkConfig,
      url: `https://rpc.testnet.fantom.network/`,
    },
    avalanche: {
      ...sharedNetworkConfig,
      url: `https://api.avax.network/ext/bc/C/rpc`,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: true,
  },
}

export default config
