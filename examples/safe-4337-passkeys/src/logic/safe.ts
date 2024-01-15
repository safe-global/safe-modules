import { abi as SafeSignerLaunchpadAbi } from '@safe-global/safe-eip4337/build/artifacts/contracts/experimental/SafeSignerLaunchpad.sol/SafeSignerLaunchpad.json'
import { abi as WebAuthnSignerFactoryAbi } from '@safe-global/safe-eip4337/build/artifacts/contracts/experimental/WebAuthnSigner.sol/WebAuthnSignerFactory.json'
import {
  abi as WebAuthnSignerAbi,
  bytecode as WebAuthSignerBytecode,
} from '@safe-global/safe-eip4337/build/artifacts/contracts/experimental/WebAuthnSigner.sol/WebAuthnSigner.json'
import { abi as Safe4337ModuleAbi } from '@safe-global/safe-eip4337/build/artifacts/contracts/Safe4337Module.sol/Safe4337Module.json'

import type { SafeSignerLaunchpad, Safe4337Module, WebAuthnSigner, WebAuthnSignerFactory } from '@safe-global/safe-eip4337/typechain-types/'

import { ethers } from 'ethers'

import { SAFE_SIGNER_LAUNCHPAD_ADDRESS, SAFE_4337_MODULE_ADDRESS, WEBAUTHN_SIGNER_FACTORY_ADDRESS } from '../config'

function getSafeSignerLaunchpadContract(provider: ethers.JsonRpcProvider): SafeSignerLaunchpad {
  return new ethers.Contract(SAFE_SIGNER_LAUNCHPAD_ADDRESS, SafeSignerLaunchpadAbi, { provider }) as unknown as SafeSignerLaunchpad
}

function getSafe4337ModuleContract(provider: ethers.JsonRpcProvider): Safe4337Module {
  return new ethers.Contract(SAFE_4337_MODULE_ADDRESS, Safe4337ModuleAbi, { provider }) as unknown as Safe4337Module
}

function getWebAuthnSignerFactoryContract(provider: ethers.JsonRpcProvider): WebAuthnSignerFactory {
  return new ethers.Contract(WEBAUTHN_SIGNER_FACTORY_ADDRESS, WebAuthnSignerFactoryAbi, { provider }) as unknown as WebAuthnSignerFactory
}

function getWebAuthnSignerContract(provider: ethers.JsonRpcProvider, address: string): WebAuthnSigner {
  return new ethers.Contract(address, WebAuthnSignerAbi, { provider }) as unknown as WebAuthnSigner
}

function getSignerAddressFromPubkeyCoords(x: string, y: string): string {
  const deploymentCode = ethers.solidityPacked(['bytes', 'uint256', 'uint256'], [WebAuthSignerBytecode, x, y])
  const salt = ethers.ZeroHash
  return ethers.getCreate2Address(WEBAUTHN_SIGNER_FACTORY_ADDRESS, salt, ethers.keccak256(deploymentCode))
}

export {
  getSafeSignerLaunchpadContract,
  getSafe4337ModuleContract,
  getWebAuthnSignerFactoryContract,
  getWebAuthnSignerContract,
  getSignerAddressFromPubkeyCoords,
}
