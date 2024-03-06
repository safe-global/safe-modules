import MultiSend from '@safe-global/safe-contracts/build/artifacts/contracts/libraries/MultiSend.sol/MultiSend.json'
import SafeProxyFactory from '@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxyFactory.sol/SafeProxyFactory.json'
import SafeL2 from '@safe-global/safe-contracts/build/artifacts/contracts/SafeL2.sol/SafeL2.json'
import Safe4337Module from '@safe-global/safe-erc4337/build/artifacts/contracts/Safe4337Module.sol/Safe4337Module.json'
import SafeModuleSetup from '@safe-global/safe-erc4337/build/artifacts/contracts/SafeModuleSetup.sol/SafeModuleSetup.json'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  if (!network.tags.safe && !network.tags.test) {
    return
  }

  const entryPoint = await deployments.getOrNull('EntryPoint')
  if (!entryPoint) {
    throw new Error('EntryPoint is not deployed')
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
  await deploy('SafeModuleSetup', {
    from: deployer,
    contract: SafeModuleSetup,
    args: [],
    log: true,
    deterministicDeployment: true,
  })
  await deploy('Safe4337Module', {
    from: deployer,
    contract: Safe4337Module,
    args: [entryPoint.address],
    log: true,
    deterministicDeployment: true,
  })
}

deploy.tags = ['safe']

export default deploy
