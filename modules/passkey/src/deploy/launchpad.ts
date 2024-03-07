import { DeployFunction } from 'hardhat-deploy/types'
import { LAUNCHPAD_DEPLOYMENT_ENTRY_POINT_ADDRESS } from '../constants'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  if (!network.tags.dev && !network.tags.test) {
    return
  }

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const entryPoint = (await deployments.getOrNull('EntryPoint').then((d) => d?.address)) || LAUNCHPAD_DEPLOYMENT_ENTRY_POINT_ADDRESS
  if (!entryPoint) {
    throw new Error('Entry point contract should be deployed or set in LAUNCHPAD_DEPLOYMENT_ENTRY_POINT_ADDRESS')
  }

  await deploy('Safe256BitECSignerLaunchpad', {
    from: deployer,
    args: [entryPoint],
    log: true,
    deterministicDeployment: true,
  })
}

export default deploy
