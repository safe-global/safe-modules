import MultiSend from '@safe-global/safe-contracts/build/artifacts/contracts/libraries/MultiSend.sol/MultiSend.json'
import SafeProxyFactory from '@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxyFactory.sol/SafeProxyFactory.json'
import SafeL2 from '@safe-global/safe-contracts/build/artifacts/contracts/SafeL2.sol/SafeL2.json'
import { DeployFunction } from 'hardhat-deploy/types'

const SAFE_PROXY_FACTORY = process.env.DEPLOYMENT_SAFE_PROXY_FACTORY_ADDRESS

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  if (!network.tags.safe && !network.tags.test) {
    return
  }

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  if (network.tags.safe || network.tags.test) {
    await deploy('MultiSend', {
      from: deployer,
      contract: MultiSend,
      args: [],
      log: true,
      deterministicDeployment: true,
    })
    await deploy('SafeProxyFactory', {
      from: deployer,
      contract: SafeProxyFactory,
      args: [],
      log: true,
      deterministicDeployment: true,
    })
    await deploy('SafeL2', {
      from: deployer,
      contract: SafeL2,
      args: [],
      log: true,
      deterministicDeployment: true,
    })
  } else if (!SAFE_PROXY_FACTORY) {
    throw new Error('DEPLOYMENT_SAFE_PROXY_FACTORY_ADDRESS must be set')
  }
}

deploy.tags = ['safe']

export default deploy
