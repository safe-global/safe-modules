import type { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('FCLP256Verifier', {
    from: deployer,
    args: [],
    deterministicDeployment: true,
    log: true,
  })
}

export default deploy
