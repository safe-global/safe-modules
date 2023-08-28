import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import {
  AbiCoder,
  concat,
  getCreate2Address,
  Interface,
  keccak256,
  ZeroAddress,
  ZeroHash,
} from 'ethers'

import {
  ArtifactGnosisSafe,
  ArtifactGnosisSafeProxy,
  ArtifactGnosisSafeProxyFactory,
} from './artifacts'

export default async function deploySafeProxy(
  factory: string,
  mastercopy: string,
  owner: string,
  deployer: SignerWithAddress
): Promise<string> {
  const initializer = calculateInitializer(owner)

  const iface = new Interface(ArtifactGnosisSafeProxyFactory.abi)
  await deployer.sendTransaction({
    to: factory,
    data: iface.encodeFunctionData('createProxyWithNonce', [
      mastercopy,
      initializer,
      ZeroHash,
    ]),
  })

  return calculateProxyAddress(initializer, factory, mastercopy)
}

function calculateInitializer(owner: string): string {
  const iface = new Interface(ArtifactGnosisSafe.abi)

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

function calculateProxyAddress(
  initializer: string,
  factory: string,
  mastercopy: string
): string {
  const salt = keccak256(concat([keccak256(initializer), ZeroHash]))

  const deploymentData = concat([
    ArtifactGnosisSafeProxy.bytecode,
    AbiCoder.defaultAbiCoder().encode(['address'], [mastercopy]),
  ])

  return getCreate2Address(factory, salt, keccak256(deploymentData))
}
