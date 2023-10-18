import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const ENTRY_POINT = process.env.DEPLOY_ENTRY_POINT

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  let entryPointAddress
  if (hre.network.name === 'hardhat' || !ENTRY_POINT) {
    const entryPoint = await deploy('TestEntryPoint', {
      from: deployer,
      args: [],
      log: true,
      deterministicDeployment: true,
    })

    entryPointAddress = entryPoint.address

    await deploy('SafeMock', {
      from: deployer,
      args: [entryPointAddress],
      log: true,
      deterministicDeployment: true,
    })

    await deploy('Safe4337Mock', {
      from: deployer,
      args: [entryPointAddress],
      log: true,
      deterministicDeployment: true,
    })
  } else {
    entryPointAddress = ENTRY_POINT
  }

  await deploy('HariWillibaldToken', {
    from: deployer,
    args: [deployer],
    log: true,
    deterministicDeployment: true,
  })

  await deploy('Simple4337Module', {
    from: deployer,
    args: [entryPointAddress],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.tags = ['eip4337', 'l2-suite', 'main-suite']
export default deploy
