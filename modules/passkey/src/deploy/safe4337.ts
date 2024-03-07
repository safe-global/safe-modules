import Safe4337Module from '@safe-global/safe-4337/build/artifacts/contracts/Safe4337Module.sol/Safe4337Module.json'
import SafeModuleSetup from '@safe-global/safe-4337/build/artifacts/contracts/SafeModuleSetup.sol/SafeModuleSetup.json'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  if (!network.tags.safe) {
    return
  }

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const entryPoint = await deployments.get('EntryPoint')

  await deploy('SafeModuleSetup', {
    from: deployer,
    contract: SafeModuleSetup,
    args: [],
    log: true,
    deterministicDeployment: true,
  })
  await deploy('Safe4337Module', {
    from: deployer,
    contract: Safe4337Module,
    args: [entryPoint.address],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.dependencies = ['entrypoint']

export default deploy
