import EntryPoint from '@account-abstraction/contracts/artifacts/EntryPoint.json'
import { DeployFunction } from 'hardhat-deploy/types'

const ENTRY_POINT = process.env.DEPLOYMENT_ENTRY_POINT_ADDRESS

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  if (network.tags.dev || network.tags.test) {
    await deploy('EntryPoint', {
      from: deployer,
      contract: EntryPoint,
      args: [],
      log: true,
      deterministicDeployment: true,
    })
  } else if (!ENTRY_POINT) {
    throw new Error('DEPLOYMENT_ENTRY_POINT_ADDRESS must be set')
  }
}

deploy.tags = ['entrypoint']

export default deploy
