import MultiSend from '@safe-global/safe-contracts/build/artifacts/contracts/libraries/MultiSend.sol/MultiSend.json'
import SafeProxyFactory from '@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxyFactory.sol/SafeProxyFactory.json'
import SafeL2 from '@safe-global/safe-contracts/build/artifacts/contracts/SafeL2.sol/SafeL2.json'
import CompatibilityFallbackHandler from '@safe-global/safe-contracts/build/artifacts/contracts/handler/CompatibilityFallbackHandler.sol/CompatibilityFallbackHandler.json'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  if (!network.tags.safe) {
    return
  }

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('MultiSend', {
    from: deployer,
    contract: MultiSend,
    args: [],
    log: true,
    deterministicDeployment: true,
  })
  await deploy('SafeL2', {
    from: deployer,
    contract: SafeL2,
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
  await deploy('CompatibilityFallbackHandler', {
    contract: CompatibilityFallbackHandler,
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.tags = ['safe']

export default deploy
