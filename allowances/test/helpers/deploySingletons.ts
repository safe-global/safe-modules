import { Contract, providers } from 'ethers'
import { getCreate2Address, keccak256, parseUnits } from 'ethers/lib/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import {
  SingletonFactoryInfo,
  getSingletonFactoryInfo,
} from '@safe-global/safe-singleton-factory'

import {
  ArtifactAllowanceModule,
  ArtifactGnosisSafe,
  ArtifactGnosisSafeProxyFactory,
} from './artifacts'
import {
  AllowanceModule,
  AllowanceModule__factory,
} from '../../typechain-types'

export type Singletons = {
  safeMastercopy: Contract
  safeProxyFactory: Contract
  allowanceModule: AllowanceModule
}

export default async function deploySingletons(
  signer: SignerWithAddress
): Promise<Singletons> {
  const factoryAddress = await deployFactory(signer)

  const safeMastercopyAddress = await deploySingleton(
    factoryAddress,
    ArtifactGnosisSafe.bytecode,
    signer
  )

  const safeProxyFactoryAddress = await deploySingleton(
    factoryAddress,
    ArtifactGnosisSafeProxyFactory.bytecode,
    signer
  )

  const allowanceModuleAddress = await deploySingleton(
    factoryAddress,
    ArtifactAllowanceModule.bytecode,
    signer
  )

  return {
    safeMastercopy: new Contract(
      safeMastercopyAddress,
      ArtifactGnosisSafe.abi,
      signer.provider
    ),
    safeProxyFactory: new Contract(
      safeProxyFactoryAddress,
      ArtifactGnosisSafeProxyFactory.abi,
      signer.provider
    ),
    allowanceModule: AllowanceModule__factory.connect(
      allowanceModuleAddress,
      signer.provider as providers.Provider
    ),
  }
}

async function deployFactory(signer: SignerWithAddress) {
  const { address, signerAddress, transaction } = getSingletonFactoryInfo(
    await signer.getChainId()
  ) as SingletonFactoryInfo

  // fund the presined transaction signer
  await signer.sendTransaction({
    to: signerAddress,
    value: parseUnits('1', 18),
  })

  // shoot the presigned transaction
  await signer.provider?.sendTransaction(transaction)

  return address
}

async function deploySingleton(
  factoryAddress: string,
  bytecode: string,
  signer: SignerWithAddress
) {
  const salt =
    '0x0000000000000000000000000000000000000000000000000000000000000000'

  await signer.sendTransaction({
    to: factoryAddress,
    data: `${salt}${bytecode.slice(2)}`,
    value: 0,
  })

  return getCreate2Address(factoryAddress, salt, keccak256(bytecode))
}

const AddressZero = '0x'.padEnd(42, '0')
const Bytes32Zero = '0x'.padEnd(66, '0')
