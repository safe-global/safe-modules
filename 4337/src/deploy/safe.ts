import { DeployFunction } from 'hardhat-deploy/types'

const SAFE_PROXY_FACTORY = process.env.DEPLOYMENT_SAFE_PROXY_FACTORY_ADDRESS

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  if (!network.tags.safe && !network.tags.test) {
    return
  }

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  if (network.tags.safe || network.tags.test) {
    await deploy('SafeProxyFactory', {
      from: deployer,
      args: [],
      log: true,
      deterministicDeployment: true,
    })
    await deploy('SafeL2', {
      from: deployer,
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
