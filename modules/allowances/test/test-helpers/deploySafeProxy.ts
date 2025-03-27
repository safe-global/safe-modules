import { Interface, ZeroAddress } from 'ethers'

import { ArtifactSafe, ArtifactSafeZk } from './artifacts'

export function calculateInitializer(owner: string, zkSync: boolean = false): string {
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
