import { Contract, getCreate2Address, keccak256, parseUnits } from 'ethers'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

import {
  SingletonFactoryInfo,
  getSingletonFactoryInfo,
} from '@safe-global/safe-singleton-factory'

import {
  ArtifactAllowanceModule,
  ArtifactGnosisSafe,
  ArtifactGnosisSafeProxyFactory,
} from './artifacts'

import { AllowanceModule } from '../../typechain-types'

export type Singletons = {
  safeMastercopy: Contract
  safeProxyFactory: Contract
  allowanceModule: AllowanceModule
}

export default async function deploySingletons(deployer: SignerWithAddress) {
  const factoryAddress = await deploySingletonFactory(deployer)

  const safeMastercopyAddress = await deploySingleton(
    factoryAddress,
    ArtifactGnosisSafe.bytecode,
    deployer
  )

  const safeProxyFactoryAddress = await deploySingleton(
    factoryAddress,
    ArtifactGnosisSafeProxyFactory.bytecode,
    deployer
  )

  const allowanceModuleAddress = await deploySingleton(
    factoryAddress,
    ArtifactAllowanceModule.bytecode,
    deployer
  )

  return {
    safeMastercopyAddress,
    safeProxyFactoryAddress,
    allowanceModuleAddress,
  }
}

async function deploySingletonFactory(signer: SignerWithAddress) {
  const { chainId } = await signer.provider.getNetwork()
  const { address, signerAddress, transaction } = getSingletonFactoryInfo(
    Number(chainId)
  ) as SingletonFactoryInfo

  // fund the presined transaction signer
  await signer.sendTransaction({
    to: signerAddress,
    value: parseUnits('1', 18),
  })

  // shoot the presigned transaction
  await signer.provider.broadcastTransaction(transaction)

  return address
}

async function deploySingleton(
  factoryAddress: string,
  bytecode: string,
  signer: SignerWithAddress
) {
  const salt = Bytes32Zero

  await signer.sendTransaction({
    to: factoryAddress,
    data: `${salt}${bytecode.slice(2)}`,
    value: 0,
  })

  return getCreate2Address(factoryAddress, salt, keccak256(bytecode))
}

const Bytes32Zero = '0x'.padEnd(66, '0')
