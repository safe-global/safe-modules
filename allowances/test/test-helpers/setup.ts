import hre from 'hardhat'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

import deploySingletons from './deploySingletons'
import deploySafeProxy from './deploySafeProxy'
import execTransaction from './execTransaction'

import {
  AllowanceModule__factory,
  ISafe__factory,
  TestToken,
  TestToken__factory,
} from '../../typechain-types'

export default async function setup() {
  const [owner, alice, bob, deployer, relayer] = await hre.ethers.getSigners()

  const {
    safeProxyFactoryAddress,
    safeMastercopyAddress,
    allowanceModuleAddress,
  } = await deploySingletons(deployer)

  const safeAddress = await deploySafeProxy(
    owner.address,
    safeProxyFactoryAddress,
    safeMastercopyAddress,
    deployer
  )
  const token = await deployTestToken(deployer)

  const safe = ISafe__factory.connect(safeAddress, relayer)
  const allowanceModule = AllowanceModule__factory.connect(
    allowanceModuleAddress,
    relayer
  )

  // fund the safe
  await token.transfer(safeAddress, 1000)

  // enable Allowance as mod
  await execTransaction(
    safe,
    await safe.enableModule.populateTransaction(allowanceModuleAddress),
    owner
  )

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
  }
}

async function deployTestToken(minter: SignerWithAddress): Promise<TestToken> {
  const factory: TestToken__factory = await hre.ethers.getContractFactory(
    'TestToken',
    minter
  )
  return await factory.connect(minter).deploy()
}
