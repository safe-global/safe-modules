import { DeployFunction } from 'hardhat-deploy/types'

const ENTRY_POINT = process.env.DEPLOY_ENTRY_POINT

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const entryPoint = await deployments.getOrNull('EntryPoint').then((deployment) => deployment?.address ?? ENTRY_POINT)

  await deploy('Safe4337Module', {
    from: deployer,
    args: [entryPoint],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.dependencies = ['entrypoint']
deploy.tags = ['modules']

export default deploy
