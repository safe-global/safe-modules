import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { AbiCoder, concat, getCreate2Address, Interface, keccak256, ZeroAddress, ZeroHash } from 'ethers'
import * as zk from 'zksync-ethers'
import hre from 'hardhat'

import {
  ArtifactSafe,
  ArtifactSafeZk,
  ArtifactSafeProxy,
  ArtifactSafeProxyZk,
  ArtifactSafeProxyFactory,
  ArtifactSafeProxyFactoryZk,
} from './artifacts'

export default async function deploySafeProxy(
  factory: string,
  mastercopy: string,
  owner: string,
  deployer: SignerWithAddress,
  zkSync: boolean = false,
): Promise<string> {
  const initializer = calculateInitializer(owner, zkSync)

  const abi = zkSync ? ArtifactSafeProxyFactoryZk.abi : ArtifactSafeProxyFactory.abi

  const iface = new Interface(abi)
  await deployer.sendTransaction({
    to: factory,
    data: iface.encodeFunctionData('createProxyWithNonce', [mastercopy, initializer, ZeroHash]),
  })

  return calculateProxyAddress(initializer, factory, mastercopy, zkSync)
}

function calculateInitializer(owner: string, zkSync: boolean = false): string {
  const iface = new Interface(zkSync ? ArtifactSafeZk.abi : ArtifactSafe.abi)

  const initializer = iface.encodeFunctionData('setup', [
    [owner], // owners
    1, // threshold
    ZeroAddress, // to - for setupModules
    '0x', // data - for setupModules
    ZeroAddress, // fallbackHandler
    ZeroAddress, // paymentToken
    0, // payment
    ZeroAddress, // paymentReceiver
  ])

  return initializer
}

function calculateProxyAddress(initializer: string, factory: string, mastercopy: string, zkSync: boolean = false): string {
  const salt = keccak256(concat([keccak256(initializer), ZeroHash]))
  const bytecode = zkSync ? ArtifactSafeProxyZk.bytecode : ArtifactSafeProxy.bytecode

  if (zkSync) {
    const bytecodeHash = hre.ethers.hexlify(zk.utils.hashBytecode(bytecode))
    const input = new hre.ethers.AbiCoder().encode(['address'], [mastercopy])
    return zk.utils.create2Address(factory, bytecodeHash, salt, input)
  }

  const deploymentData = concat([bytecode, AbiCoder.defaultAbiCoder().encode(['address'], [mastercopy])])
  // todo: use zkSync
  return getCreate2Address(factory, salt, keccak256(deploymentData))
}
