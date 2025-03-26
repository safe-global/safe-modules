import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { getSingletonFactoryInfo, SingletonFactoryInfo } from '@safe-global/safe-singleton-factory'
import { getCreate2Address, keccak256, parseUnits, ZeroHash } from 'ethers'
import hre from 'hardhat'
import * as zk from 'zksync-ethers'
import {
  ArtifactAllowanceModule,
  ArtifactAllowanceModuleZk,
  ArtifactSafe,
  ArtifactSafeZk,
  ArtifactSafeProxyFactory,
  ArtifactSafeProxyFactoryZk,
} from './artifacts'

export default async function deploySingletons(deployer: SignerWithAddress, zkSync: boolean = false) {
  const factoryAddress = await deploySingletonFactory(deployer)

  const safeBytecode = zkSync ? ArtifactSafeZk.bytecode : ArtifactSafe.bytecode
  const safeProxyFactoryBytecode = zkSync ? ArtifactSafeProxyFactoryZk.bytecode : ArtifactSafeProxyFactory.bytecode
  const allowanceModuleBytecode = zkSync ? ArtifactAllowanceModuleZk.bytecode : ArtifactAllowanceModule.bytecode

  const safeMastercopyAddress = await deploySingleton(factoryAddress, safeBytecode, deployer, zkSync)
  const safeProxyFactoryAddress = await deploySingleton(factoryAddress, safeProxyFactoryBytecode, deployer, zkSync)
  const allowanceModuleAddress = await deploySingleton(factoryAddress, allowanceModuleBytecode, deployer, zkSync)

  return {
    safeMastercopyAddress,
    safeProxyFactoryAddress,
    allowanceModuleAddress,
  }
}

async function deploySingletonFactory(signer: SignerWithAddress) {
  const { chainId } = await signer.provider.getNetwork()
  const { address, signerAddress, transaction } = getSingletonFactoryInfo(Number(chainId)) as SingletonFactoryInfo

  // fund the presined transaction signer
  await signer.sendTransaction({
    to: signerAddress,
    value: parseUnits('1', 18),
  })

  // shoot the presigned transaction
  await signer.provider.broadcastTransaction(transaction)

  return address
}

async function deploySingleton(factory: string, bytecode: string, signer: SignerWithAddress, zkSync: boolean = false) {
  const salt = ZeroHash

  await signer.sendTransaction({
    to: factory,
    data: `${salt}${bytecode.slice(2)}`,
  })

  return getContractAddress(factory, salt, bytecode, zkSync)
}

async function getContractAddress(factoryAddress: string, salt: string, bytecode: string, zkSync: boolean = false) {
  if (zkSync) {
    const bytecodeHash = hre.ethers.hexlify(zk.utils.hashBytecode(bytecode))
    const address = zk.utils.create2Address(factoryAddress, bytecodeHash, salt, '0x')
    return address
  }
  return getCreate2Address(factoryAddress, salt, keccak256(bytecode))
}
