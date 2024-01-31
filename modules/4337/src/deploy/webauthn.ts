import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  if (!network.tags.dev && !network.tags.test) {
    return
  }

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('WebAuthnVerifier', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })

  await deploy('WebAuthnSignerFactory', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })
}

export default deploy
