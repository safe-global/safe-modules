import hre, { deployments } from 'hardhat'
import { Signer, Contract } from 'ethers'
import solc from 'solc'
import { logGas } from '../../src/utils/execution';

const getRandomInt = (min = 0, max: number = Number.MAX_SAFE_INTEGER): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomIntAsString = (min = 0, max: number = Number.MAX_SAFE_INTEGER): string => {
  return getRandomInt(min, max).toString();
};

export const getSafeSingleton = async (for4337: boolean) => {
  const version = for4337 ? "Safe4337Mock" : "SafeMock"
  const SafeDeployment = await deployments.get(version);
  const Safe = await hre.ethers.getContractFactory(version);
  return Safe.attach(SafeDeployment.address);
};

export const getFactory = async () => {
    const FactoryDeployment = await deployments.get("GnosisSafeProxyFactory");
    const Factory = await hre.ethers.getContractFactory("GnosisSafeProxyFactory");
    return Factory.attach(FactoryDeployment.address);
};

export const getSafeTemplate = async (for4337: boolean = false, saltNumber: string = getRandomIntAsString()) => {
    const singleton = await getSafeSingleton(for4337);
    console.log("singleton", singleton.address)
    console.log("saltNumber", saltNumber)
    const factory = await getFactory();
    const template = await factory.callStatic.createProxyWithNonce(singleton.address, "0x", saltNumber);
    await factory.createProxyWithNonce(singleton.address, "0x", saltNumber).then((tx: any) => tx.wait());
    const Safe = await hre.ethers.getContractFactory(for4337 ? "Safe4337Mock" : "SafeMock");
    return Safe.attach(template);
};

export const getSimple4337Module = async () => {
  const ModuleDeployment = await deployments.get("Simple4337Module");
  const Module = await hre.ethers.getContractFactory("Simple4337Module");
  return Module.attach(ModuleDeployment.address);
};

export const getEntryPoint = async () => {
  const EntryPointDeployment = await deployments.get("TestEntryPoint");
  const EntryPoint = await hre.ethers.getContractFactory("TestEntryPoint");
  return EntryPoint.attach(EntryPointDeployment.address);
};

export const getSafeAtAddress = async (address: string) => {
  const safeMock = await hre.ethers.getContractFactory('SafeMock')

  return safeMock.attach(address)
}

export const getTestSafe = async (deployer: Signer, fallbackHandler?: string, moduleAddr?: string) => {
  const template = await getSafeTemplate();
  console.log("Template", template.address)
  await logGas(
      `Setup Safe for ${await deployer.getAddress()}`,
      template.setup(fallbackHandler, moduleAddr)
  );
  return template;
}

export const get4337TestSafe = async (deployer: Signer, fallbackHandler?: string, moduleAddr?: string) => {
  const template = await getSafeTemplate(true);
  await logGas(
      `Setup Safe for ${await deployer.getAddress()}`,
      template.setup(fallbackHandler, moduleAddr)
  );
  return template;
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
  return new Contract(receipt.contractAddress, output.interface, deployer)
}
