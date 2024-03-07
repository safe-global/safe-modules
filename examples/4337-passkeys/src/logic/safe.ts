import { ethers } from 'ethers'
import { abi as SafeSignerLaunchpadAbi } from '@safe-global/safe-4337/build/artifacts/contracts/experimental/SafeSignerLaunchpad.sol/SafeSignerLaunchpad.json'
import { abi as WebAuthnSignerFactoryAbi } from '@safe-global/safe-4337/build/artifacts/contracts/experimental/WebAuthnSigner.sol/WebAuthnSignerFactory.json'
import { abi as SetupModuleSetupAbi } from '@safe-global/safe-4337/build/artifacts/contracts/SafeModuleSetup.sol/SafeModuleSetup.json'
import {
  abi as WebAuthnSignerAbi,
  bytecode as WebAuthSignerBytecode,
} from '@safe-global/safe-4337/build/artifacts/contracts/experimental/WebAuthnSigner.sol/WebAuthnSigner.json'
import { abi as Safe4337ModuleAbi } from '@safe-global/safe-4337/build/artifacts/contracts/Safe4337Module.sol/Safe4337Module.json'
import { abi as SafeProxyFactoryAbi } from '@safe-global/safe-4337/build/artifacts/@safe-global/safe-contracts/contracts/proxies/SafeProxyFactory.sol/SafeProxyFactory.json'
import type {
  SafeSignerLaunchpad,
  Safe4337Module,
  SafeProxyFactory,
  WebAuthnSigner,
  WebAuthnSignerFactory,
  SafeModuleSetup,
} from '@safe-global/safe-4337/typechain-types/'

import {
  SAFE_SIGNER_LAUNCHPAD_ADDRESS,
  SAFE_4337_MODULE_ADDRESS,
  WEBAUTHN_SIGNER_FACTORY_ADDRESS,
  SAFE_PROXY_FACTORY_ADDRESS,
  WEBAUTHN_VERIFIER_ADDRESS,
} from '../config'
import { PackedUserOperation } from './userOp'

// Hardcoded because we cannot easily install @safe-global/safe-contracts because of conflicting ethers.js versions
const SafeProxyBytecode =
  '0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564'

/**
 * Creates an instance of SafeSignerLaunchpad contract using the provided JSON-RPC provider.
 *
 * @param provider The JSON-RPC provider used to interact with the blockchain.
 * @returns An instance of SafeSignerLaunchpad contract.
 */
function getSafeSignerLaunchpadContract(provider: ethers.JsonRpcProvider): SafeSignerLaunchpad {
  return new ethers.Contract(SAFE_SIGNER_LAUNCHPAD_ADDRESS, SafeSignerLaunchpadAbi, { provider }) as unknown as SafeSignerLaunchpad
}

/**
 * Returns an instance of the Safe4337Module contract.
 *
 * @param provider - The JSON-RPC provider used to interact with the Ethereum network.
 * @returns An instance of the Safe4337Module contract.
 */
function getSafe4337ModuleContract(provider: ethers.JsonRpcProvider): Safe4337Module {
  return new ethers.Contract(SAFE_4337_MODULE_ADDRESS, Safe4337ModuleAbi, { provider }) as unknown as Safe4337Module
}

/**
 * Returns an instance of the WebAuthnSignerFactory contract.
 *
 * @param provider - The JSON-RPC provider used to interact with the Ethereum network.
 * @returns An instance of the WebAuthnSignerFactory contract.
 */
function getWebAuthnSignerFactoryContract(provider: ethers.JsonRpcProvider): WebAuthnSignerFactory {
  return new ethers.Contract(WEBAUTHN_SIGNER_FACTORY_ADDRESS, WebAuthnSignerFactoryAbi, { provider }) as unknown as WebAuthnSignerFactory
}

/**
 * Creates a WebAuthnSigner contract instance.
 *
 * @param provider - The JSON-RPC provider.
 * @param address - The address of the contract.
 * @returns The WebAuthnSigner contract instance.
 */
function getWebAuthnSignerContract(provider: ethers.JsonRpcProvider, address: string): WebAuthnSigner {
  return new ethers.Contract(address, WebAuthnSignerAbi, { provider }) as unknown as WebAuthnSigner
}

/**
 * Calculates the signer address from the given public key coordinates.
 * @param x The x-coordinate of the public key.
 * @param y The y-coordinate of the public key.
 * @returns The signer address.
 */
function getSignerAddressFromPubkeyCoords(x: string, y: string): string {
  const deploymentCode = ethers.solidityPacked(
    ['bytes', 'uint256', 'uint256', 'uint256'],
    [WebAuthSignerBytecode, x, y, WEBAUTHN_VERIFIER_ADDRESS],
  )
  const salt = ethers.ZeroHash
  return ethers.getCreate2Address(WEBAUTHN_SIGNER_FACTORY_ADDRESS, salt, ethers.keccak256(deploymentCode))
}

type SafeInitializer = {
  singleton: string
  signerFactory: string
  signerData: string
  setupTo: string
  setupData: string
  fallbackHandler: string
}

function getInitHash(safeInitializer: SafeInitializer, chainId: ethers.BigNumberish): string {
  const safeInitHash = ethers.TypedDataEncoder.hash(
    { verifyingContract: SAFE_SIGNER_LAUNCHPAD_ADDRESS, chainId },
    {
      SafeInit: [
        { type: 'address', name: 'singleton' },
        { type: 'address', name: 'signerFactory' },
        { type: 'bytes', name: 'signerData' },
        { type: 'address', name: 'setupTo' },
        { type: 'bytes', name: 'setupData' },
        { type: 'address', name: 'fallbackHandler' },
      ],
    },
    safeInitializer,
  )

  return safeInitHash
}

function getLaunchpadInitializer(safeInitHash: string, optionalCallAddress = ethers.ZeroAddress, optionalCalldata = '0x'): string {
  const safeSignerLaunchpadInterface = new ethers.Interface(SafeSignerLaunchpadAbi) as unknown as SafeSignerLaunchpad['interface']

  const launchpadInitializer = safeSignerLaunchpadInterface.encodeFunctionData('preValidationSetup', [
    safeInitHash,
    optionalCallAddress,
    optionalCalldata,
  ])

  return launchpadInitializer
}

/**
 * Generates the deployment data for creating a new Safe contract proxy with a specified singleton address, initializer, and salt nonce.
 * @param singleton The address of the singleton contract.
 * @param initializer The initialization data for the Safe contract.
 * @param saltNonce The salt nonce for the Safe contract.
 * @returns The deployment data for creating the Safe contract proxy.
 */
function getSafeDeploymentData(singleton: string, initializer = '0x', saltNonce = ethers.ZeroHash): string {
  const safeProxyFactoryInterface = new ethers.Interface(SafeProxyFactoryAbi) as unknown as SafeProxyFactory['interface']
  const deploymentData = safeProxyFactoryInterface.encodeFunctionData('createProxyWithNonce', [singleton, initializer, saltNonce])

  return deploymentData
}

/**
 * Calculates the address of a safe contract based on the initializer, factory address, singleton address, and salt nonce.
 * @param initializer - The initializer bytes.
 * @param factoryAddress - The factory address used to create the safe contract. Defaults to SAFE_PROXY_FACTORY_ADDRESS.
 * @param singleton - The singleton address used for the safe contract. Defaults to SAFE_SIGNER_LAUNCHPAD_ADDRESS.
 * @param saltNonce - The salt nonce used for the safe contract. Defaults to ethers.ZeroHash.
 * @returns The address of the safe contract.
 */
function getSafeAddress(
  initializer: string,
  factoryAddress = SAFE_PROXY_FACTORY_ADDRESS,
  singleton = SAFE_SIGNER_LAUNCHPAD_ADDRESS,
  saltNonce: ethers.BigNumberish = ethers.ZeroHash,
): string {
  const deploymentCode = ethers.solidityPacked(['bytes', 'uint256'], [SafeProxyBytecode, singleton])
  const salt = ethers.solidityPackedKeccak256(['bytes32', 'uint256'], [ethers.solidityPackedKeccak256(['bytes'], [initializer]), saltNonce])
  return ethers.getCreate2Address(factoryAddress, salt, ethers.keccak256(deploymentCode))
}

/**
 * Encodes the function call to enable modules in the SafeModuleSetup contract.
 *
 * @param modules - An array of module addresses.
 * @returns The encoded function call data.
 */
function encodeSafeModuleSetupCall(modules: string[]): string {
  const safeModuleSetupInterface = new ethers.Interface(SetupModuleSetupAbi) as unknown as SafeModuleSetup['interface']
  return safeModuleSetupInterface.encodeFunctionData('enableModules', [modules])
}

/**
 * Encodes the necessary data for initializing a Safe contract and performing a user operation.
 * @param initializer - The SafeInitializer object containing the initialization parameters.
 * @param encodedUserOp - The encoded user operation data.
 * @returns The encoded data for initializing the Safe contract and performing the user operation.
 */
function getLaunchpadInitializeThenUserOpData(initializer: SafeInitializer, encodedUserOp: string): string {
  const safeSignerLaunchpadInterface = new ethers.Interface(SafeSignerLaunchpadAbi) as unknown as SafeSignerLaunchpad['interface']

  const initializeThenUserOpData = safeSignerLaunchpadInterface.encodeFunctionData('initializeThenUserOp', [
    initializer.singleton,
    initializer.signerFactory,
    initializer.signerData,
    initializer.setupTo,
    initializer.setupData,
    initializer.fallbackHandler,
    encodedUserOp,
  ])

  return initializeThenUserOpData
}

/**
 * Encodes the parameters of a user operation for execution on Safe4337Module.
 * @param to The address of the recipient of the operation.
 * @param value The amount of value to be transferred in the operation.
 * @param data The data payload of the operation.
 * @param operation The type of operation (0 for CALL, 1 for DELEGATECALL).
 * @returns The encoded data for the user operation.
 */
function getExecuteUserOpData(to: string, value: ethers.BigNumberish, data: string, operation: 0 | 1): string {
  const safe4337ModuleInterface = new ethers.Interface(Safe4337ModuleAbi) as unknown as Safe4337Module['interface']

  const executeUserOpData = safe4337ModuleInterface.encodeFunctionData('executeUserOp', [to, value, data, operation])

  return executeUserOpData
}

/**
 * Encodes the user operation data for validating a user operation.
 * @param userOp The packed user operation to be validated.
 * @param userOpHash The hash of the user operation.
 * @param missingAccountFunds The amount of missing account funds.
 * @returns The encoded data for validating the user operation.
 */
function getValidateUserOpData(userOp: PackedUserOperation, userOpHash: string, missingAccountFunds: ethers.BigNumberish): string {
  const safe4337ModuleInterface = new ethers.Interface(Safe4337ModuleAbi) as unknown as Safe4337Module['interface']

  const validateUserOpData = safe4337ModuleInterface.encodeFunctionData('validateUserOp', [userOp, userOpHash, missingAccountFunds])

  return validateUserOpData
}

export type { SafeInitializer }

export {
  getExecuteUserOpData,
  getLaunchpadInitializeThenUserOpData,
  getSafeSignerLaunchpadContract,
  getSafe4337ModuleContract,
  getWebAuthnSignerFactoryContract,
  getWebAuthnSignerContract,
  getSignerAddressFromPubkeyCoords,
  getSafeDeploymentData,
  getSafeAddress,
  getValidateUserOpData,
  getInitHash,
  getLaunchpadInitializer,
  encodeSafeModuleSetupCall,
}
