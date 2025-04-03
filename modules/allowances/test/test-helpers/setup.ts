import hre from 'hardhat'

import { calculateInitializer } from './deploySafeProxy'
import execTransaction from './execSafeTransaction'
import { ZeroHash } from 'ethers'
import { DeploymentsExtension } from 'hardhat-deploy/types'

export default async function setup(deployments: DeploymentsExtension) {
  await hre.deployments.fixture()

  const [owner, alice, bob, charlie] = await hre.ethers.getSigners()

  const safeSingleton = await deployments.get('Safe')
  const factoryDeployment = await deployments.get('SafeProxyFactory')
  const allowanceModuleDeployment = await deployments.get('AllowanceModule')
  const token = await hre.ethers.getContractAt('TestToken', (await deployments.get('TestToken')).address)

  const factory = await hre.ethers.getContractAt('SafeProxyFactory', factoryDeployment.address)
  const allowanceModule = await hre.ethers.getContractAt('AllowanceModule', allowanceModuleDeployment.address)

  const initializer = calculateInitializer(await owner.getAddress())

  const safeAddress = await factory.createProxyWithNonce.staticCall(safeSingleton.address, initializer, ZeroHash)
  await factory.createProxyWithNonce(safeSingleton.address, initializer, ZeroHash)

  const safe = await hre.ethers.getContractAt('Safe', safeAddress)

  // fund the safe
  await token.mint(safe.target, 1000)

  // enable Allowance as mod
  await execTransaction(safe, await safe.enableModule.populateTransaction(allowanceModule.target), owner)

  return {
    // the deployed safe
    safe,
    // singletons
    allowanceModule,
    // test token
    token,
    // some signers
    owner,
    alice,
    bob,
    charlie,
  }
}
