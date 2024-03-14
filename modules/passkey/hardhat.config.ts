import '@nomicfoundation/hardhat-toolbox'
import dotenv from 'dotenv'
import type { HardhatUserConfig } from 'hardhat/config'
import 'hardhat-deploy'

dotenv.config()

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
      tags: ['dev'],
    },
    hardhat: {
      tags: ['test'],
    },
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
}

export default config
