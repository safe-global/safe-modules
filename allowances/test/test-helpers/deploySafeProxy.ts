import {
  AbiCoder,
  Interface,
  concat,
  getCreate2Address,
  keccak256,
} from 'ethers'

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

import {
  ArtifactGnosisSafe,
  ArtifactGnosisSafeProxy,
  ArtifactGnosisSafeProxyFactory,
} from './artifacts'

export default async function deploySafeProxy(
  ownerAddress: string,
  factory: string,
  mastercopy: string,
  deployer: SignerWithAddress
): Promise<string> {
  const initializer = calculateInitializer(ownerAddress)

  const iface = new Interface(ArtifactGnosisSafeProxyFactory.abi)
  await deployer.sendTransaction({
    to: factory,
    data: iface.encodeFunctionData('createProxyWithNonce', [
      mastercopy,
      initializer,
      Bytes32Zero,
    ]),
  })

  return calculateProxyAddress(initializer, factory, mastercopy)
}

function calculateInitializer(ownerAddress: string) {
  const iface = new Interface(ArtifactGnosisSafe.abi)

  const initializer = iface.encodeFunctionData('setup', [
    [ownerAddress], // owners
    1, // threshold
    AddressZero, // to - for setupModules
    '0x', // data - for setupModules
    AddressZero, // fallbackHandler
    AddressZero, // paymentToken
    0, // payment
    AddressZero, // paymentReceiver
  ])

  return initializer
}

function calculateProxyAddress(
  initializer: string,
  factory: string,
  mastercopy: string
): string {
  const salt = keccak256(concat([keccak256(initializer), Bytes32Zero]))

  const deploymentData = concat([
    ArtifactGnosisSafeProxy.bytecode,
    AbiCoder.defaultAbiCoder().encode(['address'], [mastercopy]),
  ])

  return getCreate2Address(factory, salt, keccak256(deploymentData))
}

const AddressZero = '0x'.padEnd(42, '0')
const Bytes32Zero = '0x'.padEnd(66, '0')
