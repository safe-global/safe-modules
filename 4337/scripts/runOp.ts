import { parseEther } from '@ethersproject/units'
import hre, { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import {
  getRequiredPrefund,
  getSupportedEntryPoints,
} from '../src/utils/userOp'
import { chainId } from '../test/utils/encoding'
import { getSimple4337Module } from '../test/utils/setup'
import { Result } from 'ethers/lib/utils'
import { GlobalConfig, MultiProvider4337, Safe4337 } from '../src/utils/safe'

const DEBUG = process.env.SCRIPT_DEBUG || false
const MNEMONIC = process.env.SCRIPT_MNEMONIC
const BUNDLER_URL = process.env.SCRIPT_BUNDLER_URL
const SAFE_SINGLETON_ADDRESS = process.env.SCRIPT_SAFE_SINGLETON_ADDRESS!!
const PROXY_FACTORY_ADDRESS = process.env.SCRIPT_PROXY_FACTORY_ADDRESS!!
const ADD_MODULES_LIB_ADDRESS = process.env.SCRIPT_ADD_MODULES_LIB_ADDRESS!!
const MODULE_ADDRESS = process.env.SCRIPT_MODULE_ADDRESS!!

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

const buildData = (method: string, params?: any[]): string => {
  const iface = new ethers.utils.Interface([`function ${method}`])
  return iface.encodeFunctionData(method, params)
}

const callInterface = async(contract: string, method: string, params: any[] = []): Promise<Result> => {
  const result = await hre.ethers.provider.call({ 
    to: contract, 
    data: INTERFACES.encodeFunctionData(method, params)
  })
  return INTERFACES.decodeFunctionResult(method, result)
}

const runOp = async () => {
  const user1 = MNEMONIC ? hre.ethers.Wallet.fromMnemonic(MNEMONIC).connect(hre.ethers.provider) : (await hre.ethers.getSigners())[0]

  // This node only allows eth_chainId, eth_getSupportedEntrypoints, eth_sendUserOperation
  // All other methods return an error
  const accountAbstractionProvider = new MultiProvider4337(BUNDLER_URL!!, hre.ethers.provider)
  const entryPoints = await getSupportedEntryPoints(accountAbstractionProvider)
  const entryPoint = entryPoints[0]
  const moduleAddress = MODULE_ADDRESS ?? ((await getSimple4337Module()).address)
  const moduleSupportedEntrypoint = await user1.call({ to: moduleAddress, data: INTERFACES.encodeFunctionData("supportedEntryPoint")})
  console.log({moduleAddress, moduleSupportedEntrypoint})
  
  const proxyCreationCode = (await callInterface(PROXY_FACTORY_ADDRESS, "proxyCreationCode"))[0]

  const globalConfig: GlobalConfig = {
    entryPoint,
    safeSingleton: SAFE_SINGLETON_ADDRESS,
    erc4337module: MODULE_ADDRESS,
    proxyFactory: PROXY_FACTORY_ADDRESS,
    proxyCreationCode,
    addModulesLib: ADD_MODULES_LIB_ADDRESS,
    chainId: await chainId()
  }
  const safe = await Safe4337.withSigner(user1.address, globalConfig)

  safe.connect(accountAbstractionProvider)

  console.log(safe.address)
  const safeBalance = await ethers.provider.getBalance(safe.address)
  const minBalance = ethers.utils.parseEther("0.01")
  console.log(safeBalance)
  if (safeBalance < minBalance) {
    await(await user1.sendTransaction({to: safe.address, value: ethers.utils.parseEther("0.01")})).wait()
  }

  const operation = await safe.operate({
    to: '0x02270bd144e70cE6963bA02F575776A16184E1E6',
    value: parseEther('0.0001'),
    data: '0x',
    operation: 0
  })
  
  await operation.authorize(user1);

  const userOp = await operation.userOperation()
  console.log({userOp})

  console.log("checkSignatures", await ethers.provider.send("eth_call", [{
    from: entryPoint,
    to: safe.address,
    data: buildData("checkSignatures(bytes32,bytes,bytes)", [
      operation.operationHash(),
      "0x",
      await operation.encodedSignatures()
    ]),
  }, "latest"]))

  console.log("validateUserOp", await ethers.provider.send("eth_call", [{
    from: entryPoint,
    to: safe.address,
    data: buildData("validateUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32,uint256)", [
      [
        userOp.sender,
        userOp.nonce,
        userOp.initCode,
        userOp.callData,
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        userOp.paymasterAndData,
        userOp.signature
      ],
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      getRequiredPrefund(userOp)
    ]),
  }, "latest"]))

  if (DEBUG) {
    console.log('Usign account with address:', user1.address)
    console.log('Using EIP4337Diatomic deployed at:', moduleAddress)
    console.log('Using Safe contract deployed at:', safe.address)
    console.log('Using entrypoint at:', entryPoint)
    console.log('Balance of Safe:', ethers.utils.formatEther(await ethers.provider.getBalance(safe.address)), "ETH")
  }

  await accountAbstractionProvider.send('eth_sendUserOperation', [userOp, entryPoint])

  console.log('woohoo')
}

runOp()
