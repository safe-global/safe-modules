import { deployments, ethers } from 'hardhat'

export const getEntryPoint = async () => {
    const EntryPointDeployment = await deployments.get('EntryPoint')
    return await ethers.getContractAt('IEntryPoint', EntryPointDeployment.address)
}

export const getSafeL2Singleton = async () => {
    const SafeDeployment = await deployments.get('SafeL2')
    return await ethers.getContractAt('SafeL2', SafeDeployment.address)
}