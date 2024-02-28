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
      deterministicDeployment: '0x90d8084deab30c2a37c45e8d47f49f2f7965183cb6990a98943ef94940681de3',
    })
  } else if (!ENTRY_POINT) {
    throw new Error('DEPLOYMENT_ENTRY_POINT_ADDRESS must be set')
  }
}

deploy.tags = ['entrypoint']

export default deploy
