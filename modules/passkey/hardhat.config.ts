import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-ethers'
import dotenv from 'dotenv'
import type { HardhatUserConfig } from 'hardhat/config'
import 'hardhat-deploy'
import { HttpNetworkUserConfig } from 'hardhat/types'
import './src/tasks/codesize'
import './src/tasks/deployContracts'
import './src/tasks/localVerify'

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

const compilerSettings = {
  version: '0.8.26',
  settings: {
    optimizer: {
      enabled: true,
      runs: 10_000_000,
    },
    viaIR: true,
    evmVersion: 'paris',
  },
}

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
    compilers: [compilerSettings],
    overrides: {
      // FCL library does not optimize well via IR. In order to take advantage of the IR optimizer
      // in the rest of the project without causing significant regressions to the FCL verifier, we
      // add a compiler setting override for that specific contract.
      'contracts/verifiers/FCLP256Verifier.sol': {
        ...compilerSettings,
        settings: {
          ...compilerSettings.settings,
          viaIR: false,
        },
      },
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  sourcify: {
    enabled: true,
  },
}

export default config
