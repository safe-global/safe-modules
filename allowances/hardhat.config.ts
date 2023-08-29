import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-gas-reporter'
import 'hardhat-deploy'

import './tasks/deploy_verify'

import dotenv from 'dotenv'
import { HardhatUserConfig, HttpNetworkUserConfig } from 'hardhat/types'
import { DeterministicDeploymentInfo } from 'hardhat-deploy/dist/types'
import { getSingletonFactoryInfo } from '@safe-global/safe-singleton-factory'

dotenv.config()

const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY } = process.env

const sharedNetworkConfig: HttpNetworkUserConfig = {
  accounts: {
    mnemonic:
      MNEMONIC ||
      'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat',
  },
}

const config: HardhatUserConfig = {
  paths: {
    artifacts: 'build/artifacts',
    cache: 'build/cache',
    deploy: 'tasks/deploy',
    sources: 'contracts',
  },
  solidity: {
    compilers: [
      {
        // for the Allowance contact
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: false,
          },
        },
      },
      {
        // for tests
        version: '0.8.19',
      },
    ],
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
  deterministicDeployment,
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: true,
  },
}

function deterministicDeployment(network: string): DeterministicDeploymentInfo {
  const info = getSingletonFactoryInfo(parseInt(network))
  if (!info) {
    throw new Error(`
      Safe factory not found for network ${network}. You can request a new deployment at https://github.com/safe-global/safe-singleton-factory.
      For more information, see https://github.com/safe-global/safe-contracts#replay-protection-eip-155
    `)
  }

  const gasLimit = BigInt(info.gasLimit)
  const gasPrice = BigInt(info.gasPrice)

  return {
    factory: info.address,
    deployer: info.signerAddress,
    funding: String(gasLimit * gasPrice),
    signedTx: info.transaction,
  }
}

export default config
