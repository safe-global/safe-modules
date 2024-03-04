import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import type { DeployFunction } from 'hardhat-deploy/types'

const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60
const ONE_GWEI = 1_000_000_000

const deploy: DeployFunction = async ({ deployments, getNamedAccounts, ethers }) => {
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const lockedAmount = ONE_GWEI
  const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS

  await deploy('Lock', {
    from: deployer,
    args: [unlockTime],
    value: ethers.toBeHex(lockedAmount),
    log: true,
  })
}

export default deploy
