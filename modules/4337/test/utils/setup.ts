import { deployments, ethers } from 'hardhat'
import { Contract, Signer } from 'ethers'
import solc from 'solc'
import { logGas } from '../../src/utils/execution'
import { Safe4337Mock, SafeMock } from '../../typechain-types'

const getRandomInt = (min = 0, max: number = Number.MAX_SAFE_INTEGER): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const getRandomIntAsString = (min = 0, max: number = Number.MAX_SAFE_INTEGER): string => {
  return getRandomInt(min, max).toString()
}

export const getSafeL2Singleton = async () => {
  const SafeDeployment = await deployments.get('SafeL2')
  return await ethers.getContractAt('SafeL2', SafeDeployment.address)
}

export const getMockSafeSingleton = async (for4337: boolean) => {
  const version = for4337 ? 'Safe4337Mock' : 'SafeMock'
  const SafeDeployment = await deployments.get(version)
  return await ethers.getContractAt(version, SafeDeployment.address)
}

export const getFactory = async () => {
  const FactoryDeployment = await deployments.get('SafeProxyFactory')
  return await ethers.getContractAt('SafeProxyFactory', FactoryDeployment.address)
}

export const getSafeTemplate = async (for4337 = false, saltNumber = getRandomIntAsString()) => {
  const singleton = await getMockSafeSingleton(for4337)
  console.log('singleton', await singleton.getAddress())
  console.log('saltNumber', saltNumber)
  const factory = await getFactory()
  const template = await factory.createProxyWithNonce.staticCall(await singleton.getAddress(), '0x', saltNumber)
  await factory.createProxyWithNonce(await singleton.getAddress(), '0x', saltNumber).then((tx) => tx.wait())
  return await ethers.getContractAt(for4337 ? 'Safe4337Mock' : 'SafeMock', template)
}

export const getSafeModuleSetup = async () => {
  const { address } = await deployments.get('SafeModuleSetup')
  return await ethers.getContractAt('SafeModuleSetup', address)
}

export const getSafe4337Module = async () => {
  const ModuleDeployment = await deployments.get('Safe4337Module')
  return await ethers.getContractAt('Safe4337Module', ModuleDeployment.address)
}

export const getEntryPoint = async () => {
  const EntryPointDeployment = await deployments.get('EntryPoint')
  return await ethers.getContractAt('IEntryPoint', EntryPointDeployment.address)
}

export const getEntryPointSimulations = async () => {
  const EntryPointDeployment = await deployments.get('EntryPointSimulations')
  return await ethers.getContractAt('EntryPointSimulations', EntryPointDeployment.address)
}

export const getSafeAtAddress = async (address: string) => {
  return await ethers.getContractAt('SafeMock', address)
}

export const getTestSafe = async (deployer: Signer, fallbackHandler: string, moduleAddr: string) => {
  const template = (await getSafeTemplate()) as unknown as SafeMock
  console.log('Template', await template.getAddress())
  await logGas(`Setup Safe for ${await deployer.getAddress()}`, template.setup(fallbackHandler, moduleAddr))
  return template
}

export const get4337TestSafe = async (deployer: Signer, fallbackHandler: string, moduleAddr: string) => {
  const template = (await getSafeTemplate(true)) as unknown as Safe4337Mock
  await logGas(`Setup Safe for ${await deployer.getAddress()}`, template.setup(fallbackHandler, moduleAddr))
  return template
}

export const compile = async (source: string) => {
  const input = JSON.stringify({
    language: 'Solidity',
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode'],
        },
      },
    },
    sources: {
      'tmp.sol': {
        content: source,
      },
    },
  })
  const solcData = await solc.compile(input)
  const output = JSON.parse(solcData)
  if (!output['contracts']) {
    console.log(output)
    throw Error('Could not compile contract')
  }
  const fileOutput = output['contracts']['tmp.sol']
  const contractOutput = fileOutput[Object.keys(fileOutput)[0]]
  const abi = contractOutput['abi']
  const data = '0x' + contractOutput['evm']['bytecode']['object']
  return {
    data: data,
    interface: abi,
  }
}

export const deployContract = async (deployer: Signer, source: string): Promise<Contract> => {
  const output = await compile(source)
  const transaction = await deployer.sendTransaction({ data: output.data, gasLimit: 6000000 })
  const receipt = await transaction.wait()
  const contractAddress = receipt.contractAddress
  if (contractAddress === null) {
    throw new Error(`contract deployment transaction ${transaction.hash} missing address`)
  }
  return new Contract(contractAddress, output.interface, deployer)
}
