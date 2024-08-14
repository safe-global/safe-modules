import EntryPoint from '@account-abstraction/contracts/artifacts/EntryPoint.json'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import type { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async (hre) => {
  const { deployments, getNamedAccounts, network } = hre
  if (!network.tags.entrypoint) {
    return
  }

  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  // The official ERC-4337 entry point contract is deployed using the Arachnid CREATE2 deployer.
  await withArachnidDeterministicDeploymentProxy(hre, () =>
    deploy('EntryPoint', {
      from: deployer,
      contract: EntryPoint,
      args: [],
      log: true,
      deterministicDeployment: '0x90d8084deab30c2a37c45e8d47f49f2f7965183cb6990a98943ef94940681de3',
    }),
  )
}

function withArachnidDeterministicDeploymentProxy<T>({ config }: HardhatRuntimeEnvironment, f: () => Promise<T>): Promise<T> {
  // This is a bit hacky - but the `hardhat-deploy` package reads that deterministic deployment
  // configuration before deploying each contract. This means that we can temporarily override the
  // the configuration to `undefined` so that it uses the (default) Arachnid deterministic
  // deployment proxy for a specific deployment, and then restore the configuration afterwards so
  // that remaining contracts use the deterministic deployment factory from `hardhat.config.ts`.
  const existingConfig = config.deterministicDeployment
  config.deterministicDeployment = undefined
  return f().finally(() => {
    config.deterministicDeployment = existingConfig
  })
}

deploy.tags = ['entrypoint']

export default deploy
