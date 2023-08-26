import { Contract } from 'ethers'
import {
  concat,
  defaultAbiCoder,
  getCreate2Address,
  keccak256,
} from 'ethers/lib/utils'

import { ArtifactGnosisSafe, ArtifactGnosisSafeProxy } from './artifacts'
import { Singletons } from './deploySingletons'

export default async function deploySafeProxy(
  ownerAddress: string,
  singletons: Singletons
): Promise<Contract> {
  const { safeMastercopy, safeProxyFactory } = singletons
  const initializer = calculateInitializer(ownerAddress, safeMastercopy)

  await safeProxyFactory.createProxyWithNonce(
    safeMastercopy.address,
    initializer,
    Bytes32Zero
  )

  const address = calculateProxyAddress(initializer, singletons)

  return new Contract(address, ArtifactGnosisSafe.abi, safeProxyFactory.signer)
}

function calculateInitializer(ownerAddress: string, safeMastercopy: Contract) {
  const initializer = safeMastercopy.interface.encodeFunctionData('setup', [
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
  { safeMastercopy, safeProxyFactory }: Singletons
): string {
  const salt = keccak256(concat([keccak256(initializer), Bytes32Zero]))

  const deploymentData = concat([
    ArtifactGnosisSafeProxy.bytecode,
    defaultAbiCoder.encode(['address'], [safeMastercopy.address]),
  ])

  return getCreate2Address(
    safeProxyFactory.address,
    salt,
    keccak256(deploymentData)
  )
}

const AddressZero = '0x'.padEnd(42, '0')
const Bytes32Zero = '0x'.padEnd(66, '0')
