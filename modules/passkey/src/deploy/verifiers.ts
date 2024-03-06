import type { DeployFunction } from 'hardhat-deploy/types'

import DaimoP256Verifier from '../vendor/daimo-eth/P256Verifier.json'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('DaimoP256Verifier', {
    from: deployer,
    contract: DaimoP256Verifier,
    args: [],
    deterministicDeployment: true,
    log: true,
  })

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
