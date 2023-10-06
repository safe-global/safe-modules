import { constants, ethers, providers } from 'ethers'

const INTERFACES = new ethers.utils.Interface([
    'function enableModule(address)',
    'function setup(address[],uint256,address,bytes,address,address,uint256,address)',
    'function createProxyWithNonce(address,bytes,uint256) returns (address)',
    'function proxyCreationCode() returns (bytes)',
    'function enableModules(address[])',
    'function getNonce(address,uint192) returns (uint256 nonce)',
    'function supportedEntryPoint() returns (address)',
    'function getOwners() returns (address[])',
    'function getModulesPaginated(address, uint256) returns (address[], address)',
    'function getOperationHash(address,bytes,uint256,uint256,uint256,uint256,uint256,uint256,address)'
  ])

interface GlobalConfig {
    safeSingleton: string,
    entryPoint: string,
    erc4337module: string,
    proxyFactory: string,
    proxyCreationCode: string
    addModulesLib: string
}

interface SafeConfig {
    signers: string[]
    threshold: number,
    nonce: number
}

const calculateProxyAddress = (globalConfig: GlobalConfig, inititalizer: string, nonce: number | string): string => {
    const deploymentCode = ethers.utils.solidityPack(["bytes", "uint256"], [globalConfig.proxyCreationCode, globalConfig.safeSingleton]);
    const salt = ethers.utils.solidityKeccak256(["bytes32", "uint256"], [ethers.utils.solidityKeccak256(["bytes"], [inititalizer]), nonce]);
    return ethers.utils.getCreate2Address(globalConfig.proxyFactory, salt, ethers.utils.keccak256(deploymentCode));
  };

const buildInitParamsForConfig = (safeConfig: SafeConfig, globalConfig: GlobalConfig): { safeAddress: string, initCode: string } => {
    const initData = INTERFACES.encodeFunctionData("enableModules", [[globalConfig.erc4337module, globalConfig.entryPoint]])
    const setupData = INTERFACES.encodeFunctionData("setup", [
        safeConfig.signers, safeConfig.threshold, globalConfig.addModulesLib, initData, globalConfig.erc4337module, constants.AddressZero, 0, constants.AddressZero
    ])
    const deployData = INTERFACES.encodeFunctionData("createProxyWithNonce", [
        globalConfig.safeSingleton, setupData, safeConfig.nonce
    ])
    const safeAddress = calculateProxyAddress(globalConfig, setupData, safeConfig.nonce)
    const initCode = ethers.utils.solidityPack(["address", "bytes"], [globalConfig.proxyFactory, deployData])
    return {
        safeAddress,
        initCode
    }
}

export class Safe4337 {

    public address: string;
    private configs: { safe: SafeConfig, global: GlobalConfig } | undefined;

    constructor(address: string, configs?: { safe: SafeConfig, global: GlobalConfig }) {
        if (configs) {
            const initParams = buildInitParamsForConfig(configs.safe, configs.global)
            if (address !== initParams.safeAddress) throw Error("Invalid configs");
        }
        this.address = address;
        this.configs = configs;
    }

    static async withSigner(signer: string, globalConfig: GlobalConfig): Promise<Safe4337> {
        const safeConfig: SafeConfig = {
            signers: [signer],
            threshold: 1,
            nonce: 0
        }
        return Safe4337.withConfigs(safeConfig, globalConfig)
    }

    getInitCode(): string {
        if (!this.configs) throw Error("Init code not available");
        const initParams = buildInitParamsForConfig(this.configs.safe, this.configs.global)
        return initParams.initCode
    }

    async getSigners(): Promise<string[]> {
        return this.configs?.safe.signers!!
    }

    static async withConfigs(safeConfig: SafeConfig, globalConfig: GlobalConfig): Promise<Safe4337> {
        const initParams = buildInitParamsForConfig(safeConfig, globalConfig)
        return new Safe4337(initParams.safeAddress, { safe: safeConfig, global: globalConfig })
    } 
}