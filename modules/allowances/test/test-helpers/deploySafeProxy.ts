import { Interface, ZeroAddress } from 'ethers'

import ArtifactSafe from '../../build/artifacts/@safe-global/safe-contracts/contracts/Safe.sol/Safe.json'
import ArtifactSafeZk from '../../build/artifacts-zk/@safe-global/safe-contracts/contracts/Safe.sol/Safe.json'

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
