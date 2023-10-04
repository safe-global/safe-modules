import { parseEther } from '@ethersproject/units'
import hre, { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import { buildSignatureBytes, signHash } from '../src/utils/execution'
import {
  buildSafeUserOp,
  getRequiredPrefund,
  calculateSafeOperationHash,
  buildUserOperationFromSafeUserOperation,
  getSupportedEntryPoints,
  buildSafeUserOpTransaction,
  signSafeOp,
} from '../src/utils/userOp'
import { chainId } from '../test/utils/encoding'
import { getSimple4337Module } from '../test/utils/setup'

const DEBUG = process.env.SCRIPT_DEBUG || false
const MNEMONIC = process.env.SCRIPT_MNEMONIC
const BUNLDER_URL = process.env.SCRIPT_BUNDLER_URL
const SAFE_ADDRESS = process.env.SCRIPT_SAFE_ADDRESS
const MODULE_ADDRESS = process.env.SCRIPT_MODULE_ADDRESS

const buildData = (method: string, params?: any[]): string => {
  const iface = new ethers.utils.Interface([`function ${method}`])
  return iface.encodeFunctionData(method, params)
}

const runOp = async () => {
  const user1 = MNEMONIC ? hre.ethers.Wallet.fromMnemonic(MNEMONIC).connect(hre.ethers.provider) : (await hre.ethers.getSigners())[0]

  // This node only allows eth_chainId, eth_getSupportedEntrypoints, eth_sendUserOperation
  // All other methods return an error
  const accountAbstractionProvider = new hre.ethers.providers.JsonRpcProvider(BUNLDER_URL)
  const moduleAddress = MODULE_ADDRESS ?? ((await getSimple4337Module()).address)
  const safeAddress = SAFE_ADDRESS!!
  const entryPoints = await getSupportedEntryPoints(accountAbstractionProvider)
  const entryPoint = entryPoints[0]

  const feeData = await ethers.provider.getFeeData()
  console.log({feeData})

  const legacyFee = feeData.maxFeePerGas!!.add(feeData.maxPriorityFeePerGas!!).toString()
  const safeOp = buildSafeUserOpTransaction(
    safeAddress,
    '0x02270bd144e70cE6963bA02F575776A16184E1E6',
    parseEther('0.1'),
    '0x',
    '0',
    entryPoint,
    false,
    {
      maxFeePerGas: legacyFee,
      maxPriorityFeePerGas: legacyFee,
      callGas: '1000000',
    },
  )

  console.log(await chainId())
  console.log(await user1.address)
  const safeOpHash = calculateSafeOperationHash(moduleAddress, safeOp, await chainId())
  const signature = buildSignatureBytes([await signSafeOp(user1, moduleAddress, safeOp, await chainId())])
  console.log({ safeOpHash, signature })
  const userOp = buildUserOperationFromSafeUserOperation({
    safeAddress,
    safeOp,
    signature,
  })
  console.log(userOp)

  console.log("validateUserOp", await ethers.provider.send("eth_call", [{
    from: entryPoint,
    to: safeAddress,
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

  console.log(await accountAbstractionProvider.send('eth_estimateUserOperationGas', [{
    ...userOp
  }, entryPoint]))

  if (DEBUG) {
    console.log('Usign account with address:', user1.address)
    console.log('Using EIP4337Diatomic deployed at:', moduleAddress)
    console.log('Using Safe contract deployed at:', safeAddress)
    console.log('Using entrypoint at:', entryPoints[1])
  }

  await accountAbstractionProvider.send('eth_sendUserOperation', [userOp, entryPoint])

  console.log('woohoo')
}

runOp()
