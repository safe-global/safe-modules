import EntryPoint from '@account-abstraction/contracts/artifacts/EntryPoint.json'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  if (!network.tags.entrypoint) {
    return
  }

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('EntryPoint', {
    from: deployer,
    contract: EntryPoint,
    args: [],
    log: true,
    deterministicDeployment: '0x90d8084deab30c2a37c45e8d47f49f2f7965183cb6990a98943ef94940681de3',
  })
}

deploy.tags = ['entrypoint']

export default deploy
