import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  if (!network.tags.dev && !network.tags.test) {
    return
  }

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const entryPoint = await deployments.get('EntryPoint')

  await deploy('SafeOpLaunchpad', {
    from: deployer,
    args: [entryPoint.address],
    log: true,
    deterministicDeployment: true,
  })
  await deploy('SafeSignerLaunchpad', {
    from: deployer,
    args: [entryPoint.address],
    log: true,
    deterministicDeployment: true,
  })
}

export default deploy