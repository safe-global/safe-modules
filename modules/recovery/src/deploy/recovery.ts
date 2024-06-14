import { DeployFunction } from 'hardhat-deploy/types'
import { getDeploymentParameters } from '../utils/deployment'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const { recoveryPeriod } = getDeploymentParameters()

  await deploy('SocialRecoveryModule', {
    from: deployer,
    args: [recoveryPeriod],
    log: true,
    deterministicDeployment: true,
  })
}

export default deploy
