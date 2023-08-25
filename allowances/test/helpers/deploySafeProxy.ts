import { Contract, providers } from 'ethers'
import {
  concat,
  defaultAbiCoder,
  getCreate2Address,
  keccak256,
} from 'ethers/lib/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { ArtifactGnosisSafe, ArtifactGnosisSafeProxy } from './artifacts'
import { Singletons } from './deploySingletons'

export default async function deploySafeProxy(
  owner: SignerWithAddress,
  singletons: Singletons
): Promise<Contract> {
  const { safeMastercopy, safeProxyFactory } = singletons
  const initializer = _initializer(owner, safeMastercopy)

  await (
    await owner.sendTransaction({
      to: safeProxyFactory.address,
      data: safeProxyFactory.interface.encodeFunctionData(
        'createProxyWithNonce',
        [safeMastercopy.address, initializer, Bytes32Zero]
      ),
      value: 0,
    })
  ).wait()

  const safeProxyAddress = calculateProxyAddress(initializer, singletons)

  return new Contract(
    safeProxyAddress,
    ArtifactGnosisSafe.abi,
    owner.provider as providers.Provider
  )
}

function _initializer(owner: SignerWithAddress, safeMastercopy: Contract) {
  const initializer = safeMastercopy.interface.encodeFunctionData('setup', [
    [owner.address], // owners
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
