import { Signer } from 'ethers'
import { deployments, ethers } from 'hardhat'
import { logGas } from '../../src/utils/execution'
import { SafeMock } from '../../typechain-types'

const getRandomInt = (min = 0, max: number = Number.MAX_SAFE_INTEGER): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min
}
const getRandomIntAsString = (min = 0, max: number = Number.MAX_SAFE_INTEGER): string => {
    return getRandomInt(min, max).toString()
}

export const getEntryPoint = async () => {
    const EntryPointDeployment = await deployments.get('EntryPoint')
    return await ethers.getContractAt('IEntryPoint', EntryPointDeployment.address)
}

export const getSafeL2Singleton = async () => {
    const SafeDeployment = await deployments.get('SafeL2')
    return await ethers.getContractAt('SafeL2', SafeDeployment.address)
}

export const getFactory = async () => {
    const FactoryDeployment = await deployments.get('SafeProxyFactory')
    return await ethers.getContractAt('SafeProxyFactory', FactoryDeployment.address)
}

export const getMockSafeSingleton = async (for4337: boolean) => {
    const version = for4337 ? 'Safe4337Mock' : 'SafeMock'
    const SafeDeployment = await deployments.get(version)
    return await ethers.getContractAt(version, SafeDeployment.address)
}

export const getSafeTemplate = async (for4337 = false, saltNumber = getRandomIntAsString()) => {
    const singleton = await getMockSafeSingleton(for4337)
    
    const factory = await getFactory()
    const template = await factory.createProxyWithNonce.staticCall(await singleton.getAddress(), '0x', saltNumber)
    await factory.createProxyWithNonce(await singleton.getAddress(), '0x', saltNumber).then((tx) => tx.wait())
    return await ethers.getContractAt(for4337 ? 'Safe4337Mock' : 'SafeMock', template)
}

export const getTestSafe = async (deployer: Signer, fallbackHandler: string, moduleAddr: string) => {
    const template = (await getSafeTemplate()) as unknown as SafeMock
    await logGas(`Setup Safe for ${await deployer.getAddress()}`, template.setup(fallbackHandler, moduleAddr))
    return template
}
