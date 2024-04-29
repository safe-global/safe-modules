import { DeployFunction } from 'hardhat-deploy/types'
const ENTRY_POINT = process.env.DEPLOYMENT_ENTRY_POINT_ADDRESS

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const entryPoint = await deployments.getOrNull('EntryPoint').then((deployment) => deployment?.address ?? ENTRY_POINT)

  await deploy('Safe6900Module', {
    from: deployer,
    args: [entryPoint],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.dependencies = ['safe6900module']

export default deploy
