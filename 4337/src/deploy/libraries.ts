import { DeployFunction } from 'hardhat-deploy/types'

const SAFE_PROXY_FACTORY = process.env.DEPLOYMENT_SAFE_PROXY_FACTORY_ADDRESS

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('AddModulesLib', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })

  const factory = await deployments.getOrNull('SafeProxyFactory').then((deployment) => deployment?.address ?? SAFE_PROXY_FACTORY)
  await deploy('StakedFactoryProxy', {
    from: deployer,
    args: [factory],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.dependencies = ['safe']
deploy.tags = ['libraries']

export default deploy
