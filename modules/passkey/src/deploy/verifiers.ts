import type { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const FCLP256Verifier = await deploy('FCLP256Verifier', {
    from: deployer,
    args: [],
    deterministicDeployment: true,
    log: true,
  })

  await deploy('WebAuthnVerifier', {
    from: deployer,
    args: [FCLP256Verifier.address],
    log: true,
    deterministicDeployment: true,
  })
}

export default deploy
