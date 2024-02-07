import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('SafeModuleSetup', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.tags = ['libraries']

export default deploy
