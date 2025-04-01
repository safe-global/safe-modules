import { Interface, ZeroAddress } from 'ethers'

import ArtifactSafe from '../../build/artifacts/@safe-global/safe-contracts/contracts/Safe.sol/Safe.json'

export function calculateInitializer(owner: string): string {
  const iface = new Interface(ArtifactSafe.abi)

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
