import { DeployFunction } from 'hardhat-deploy/types'
import SafeProxyFactory from '@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxyFactory.sol/SafeProxyFactory.json'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('Safe', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })
  await deploy('SafeProxyFactory', {
    from: deployer,
    contract: SafeProxyFactory,
    args: [],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.dependencies = ['safe']

export default deploy
