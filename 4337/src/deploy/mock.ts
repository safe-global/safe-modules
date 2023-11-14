import { DeployFunction } from 'hardhat-deploy/types'

const ENTRY_POINT = process.env.DEPLOY_ENTRY_POINT

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  if (!network.tags.test) {
    return
  }

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const entryPoint = await deployments.getOrNull('EntryPoint').then((deployment) => deployment?.address ?? ENTRY_POINT)

  await deploy('SafeMock', {
    from: deployer,
    args: [entryPoint],
    log: true,
    deterministicDeployment: true,
  })

  await deploy('Safe4337Mock', {
    from: deployer,
    args: [entryPoint],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.dependencies = ['entrypoint']
deploy.tags = ['mock']

export default deploy
