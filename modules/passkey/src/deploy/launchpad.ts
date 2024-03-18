import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const entryPoint = await deployments.get('EntryPoint')

  await deploy('SafeECDSASignerLaunchpad', {
    from: deployer,
    args: [entryPoint.address],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.dependencies = ['entrypoint']

export default deploy
