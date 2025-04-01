import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { getDeployerAccount } from '../../src/deploy'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre
  const { deploy } = deployments
  const deployerAccount = await getDeployerAccount(hre)

  await deploy('TestToken', {
    from: deployerAccount,
    args: [],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.tags = ['TestToken']

export default deploy
