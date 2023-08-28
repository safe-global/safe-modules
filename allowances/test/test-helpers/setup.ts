import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import hre from 'hardhat'

import {
  AllowanceModule__factory,
  ISafe__factory,
  TestToken,
  TestToken__factory,
} from '../../typechain-types'

import deploySafeProxy from './deploySafeProxy'
import deploySingletons from './deploySingletons'
import execTransaction from './execSafeTransaction'

export default async function setup() {
  const [owner, alice, bob, deployer, relayer] = await hre.ethers.getSigners()

  const {
    safeProxyFactoryAddress,
    safeMastercopyAddress,
    allowanceModuleAddress,
  } = await deploySingletons(deployer)

  const safeAddress = await deploySafeProxy(
    safeProxyFactoryAddress,
    safeMastercopyAddress,
    owner.address,
    deployer
  )
  const token = await deployTestToken(deployer)

  // both the safe and the allowance work by signature
  // connect the contracts to a signer that has funds
  // but isn't safe owner, or allowance spender
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
