import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const entryPoint = await deploy('TestEntryPoint', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })

  await deploy('SafeMock', {
    from: deployer,
    args: [entryPoint.address],
    log: true,
    deterministicDeployment: true,
  })

  await deploy('Safe4337Mock', {
    from: deployer,
    args: [entryPoint.address],
    log: true,
    deterministicDeployment: true,
  })

  await deploy('Simple4337Module', {
    from: deployer,
    args: [entryPoint.address],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.tags = ['eip4337', 'l2-suite', 'main-suite']
export default deploy
