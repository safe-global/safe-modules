import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-ethers'
import 'hardhat-deploy'
import dotenv from 'dotenv'
import type { HardhatUserConfig, HttpNetworkUserConfig } from 'hardhat/types'
import yargs from 'yargs/yargs'
import { getSingletonFactoryInfo } from "@safe-global/safe-singleton-factory";
import { DeterministicDeploymentInfo } from "hardhat-deploy/dist/types";

import './src/tasks/deployContracts'
import './src/tasks/localVerify'

const argv = yargs(process.argv.slice(2))
  .options({ network: { type: 'string', default: 'hardhat' } })
  .help(false)
  .version(false)
  .parseSync()

// Load environment variables.
dotenv.config()
const { CUSTOM_NODE_URL, INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, PK } = process.env

const DEFAULT_MNEMONIC = 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'

const sharedNetworkConfig: HttpNetworkUserConfig = {}
if (PK) {
  sharedNetworkConfig.accounts = [PK]
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  }
}

if (['mainnet', 'sepolia'].includes(argv.network) && INFURA_KEY === undefined) {
  throw new Error(`Could not find Infura key in env, unable to connect to network ${argv.network}`)
}

const customNetwork = CUSTOM_NODE_URL
  ? {
      custom: {
        ...sharedNetworkConfig,
        url: CUSTOM_NODE_URL,
      },
    }
  : {}

const deterministicDeployment = (network: string): DeterministicDeploymentInfo => {
    const info = getSingletonFactoryInfo(parseInt(network));
    if (!info) {
        throw new Error(`
        Safe factory not found for network ${network}. You can request a new deployment at https://github.com/safe-global/safe-singleton-factory.
        For more information, see https://github.com/safe-global/safe-smart-account#replay-protection-eip-155
      `);
    }

    const gasLimit = BigInt(info.gasLimit)
    const gasPrice = BigInt(info.gasPrice)
  
    return {
        factory: info.address,
        deployer: info.signerAddress,
        funding: String(gasLimit * gasPrice),
        signedTx: info.transaction,
    };
};

const userConfig: HardhatUserConfig = {
  paths: {
    artifacts: 'build/artifacts',
    cache: 'build/cache',
    deploy: 'src/deploy',
    sources: 'contracts',
  },
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1_000_000,
      },
      viaIR: true,
    },
  },
  networks: {
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    },
    sepolia: {
      ...sharedNetworkConfig,
      url: `https://sepolia.infura.io/v3/${INFURA_KEY}`,
      tags: ['dev', 'entrypoint'],
    },
    ...customNetwork,
  },
  deterministicDeployment,
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
}
export default userConfig
