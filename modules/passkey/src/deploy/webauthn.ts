import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('SafeWebAuthnSignerFactory', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })

  await deploy('SafeWebAuthnSignerProxyFactory', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })

  await deploy('SafeWebAuthnSignerSingleton', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })
}

export default deploy
