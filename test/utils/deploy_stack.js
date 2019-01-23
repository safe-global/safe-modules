
/*
 How to run the command
 ----------------------
 The script inherits a Web3 instance from Truffle, according to the configuration
 contained within truffle.js.

./node_modules/.bin/truffle exec test/utils/deploy_stack.js --dutchx-address 0xb529f14aa8096f943177c09ca294ad66d2e08b1f

The `this` variable is an object containing a set of values inherited from Truffle.

*/

const args = require('yargs').option('dutchx-address', {
  string: true
}).argv // ask argv to treat args as a string

const constants = require('../../scripts/constants')
const gnosisUtils = require('../../scripts/utils')(this.web3) // Get web3 from injected global variables

// Contracts
const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const DutchXCompleteModule = artifacts.require("./DutchXCompleteModule.sol")
const DutchXSellerModule = artifacts.require("./DutchXSellerModule.sol")

module.exports = async function(callback) {
  let accounts, dutchxAddress, masterCopyAddress, masterCopyInstance, proxyFactoryAddress, proxyFactoryInstance
  const whitelistedTokens = [] // skip whitelist deploy in this script

  if (!args.mnemonic) {
    console.log("Using Truffle Mnemonic configuration")
  } else {
    console.log("Provided mnemonic: " + args.mnemonic)
  }

  if (!args['dutchx-address']) {
    callback('--dutchx-address argument not provided. Please provide the DutchX address')
  } else {
    dutchxAddress = args['dutchx-address']
  }

  // Truffle uses the HTTPPRovider When on LOCALHOST, so we need to pass the mnemonic seed via command
  const mnemonic = args.mnemonic || this.web3.currentProvider.mnemonic
  const lightWallet = await gnosisUtils.createLightwallet(mnemonic)
  masterCopyAddress = args['master-copy']
  proxyFactoryAddress = args['proxy-factory']
  accounts = lightWallet.accounts

  // Check owners/accounts and set threshold
  const owners = [accounts[0], accounts[1]]
  threshold = 2

  // Istantiate contracts
  console.log("Deploy ProxyFactory")
  proxyFactoryInstance = await ProxyFactory.new()
  console.log("Proxy factory address: " + proxyFactoryInstance.address)

  let safeInstance, gnosisSafeData
  console.log("Deploy GnosisSafe master copy")
  masterCopyInstance = await GnosisSafe.new()
  console.log("Master copy address: " + masterCopyInstance.address)

  // Create Gnosis Safe
  gnosisSafeData = await masterCopyInstance.contract.setup.getData(owners, threshold, 0, "0x")
  console.log("Execute createProxy")
  let proxyInstance = await proxyFactoryInstance.createProxy(masterCopyInstance.address, gnosisSafeData)
  let proxyAddress = proxyInstance.logs[0].args.proxy
  safeInstance = GnosisSafe.at(proxyAddress)

  const contractOwners = await safeInstance.getOwners()

  // Print generic info
  console.log("Owners: ".concat(contractOwners))
  console.log("Threshold: " + threshold)
  console.log("Safe address: " + safeInstance.address)

  // Create DX Module
  const dxCompleteModuleInstance = await DutchXCompleteModule.new([])
  const dxSellerModuleInstance = await DutchXSellerModule.new([])
  let dxModuleSetupData, dxModuleAddress
  try {
    dxModuleAddress = dxCompleteModuleInstance.address
    console.log(`=========== DX COMPLETE MODULE SETUP ==============`)
    console.log(`DX Module address: ${dxModuleAddress}`)
    console.log(`Provided DutchX Address: ${dutchxAddress}`)
    console.log("Get data dxModule.setup(dxModuleAddress, whitelistedTokens, owners) ...")
    dxModuleSetupData = await dxCompleteModuleInstance.contract.setup.getData(dutchxAddress, whitelistedTokens, owners)
    console.log("Get Safe instance nonce...")
    nonce = await safeInstance.nonce()
    console.log(`Safe Nonce: ${nonce}`)
    console.log("Calculate transaction hash, safeInstance.getTransactionHash(...) ...")
    transactionHash = await safeInstance.getTransactionHash(dxModuleAddress, 0, dxModuleSetupData, constants.CALL, 0, 0, 0, 0, 0, nonce)
    console.log("Sign transaction...")
    signatures = gnosisUtils.signTransaction(lightWallet, owners, transactionHash)
    gnosisUtils.logGasUsage(
        'execTransaction dxModule.setup() from the Safe',
        await safeInstance.execTransaction(
            dxModuleAddress, 0, dxModuleSetupData, constants.CALL, 0, 0, 0, 0, 0, signatures
        )
    )
    // Lookup DutchX address on DX Module contract, it has to be equals to args.dutchx-address
    let lookupDutchxAddress = await dxCompleteModuleInstance.dutchXAddress()
    console.log(`DutchX address setted ${lookupDutchxAddress.toLowerCase() == dutchxAddress.toLowerCase() ? 'correctly' : 'incorrectly'} on DX Module`)
    console.log("==========================================")
  } catch(error) {
    callback(error)
  }

  try {
    dxModuleAddress = dxSellerModuleInstance.address
    console.log(`=========== DX SELLER MODULE SETUP ==============`)
    console.log(`DX Module address: ${dxModuleAddress}`)
    console.log(`Provided DutchX Address: ${dutchxAddress}`)
    console.log("Get data dxModule.setup(dxModuleAddress, whitelistedTokens, owners) ...")
    dxModuleSetupData = await dxSellerModuleInstance.contract.setup.getData(dutchxAddress, whitelistedTokens, owners)
    console.log("Get Safe instance nonce...")
    nonce = await safeInstance.nonce()
    console.log(`Safe Nonce: ${nonce}`)
    console.log("Calculate transaction hash, safeInstance.getTransactionHash(...) ...")
    transactionHash = await safeInstance.getTransactionHash(dxModuleAddress, 0, dxModuleSetupData, constants.CALL, 0, 0, 0, 0, 0, nonce)
    console.log("Sign transaction...")
    signatures = gnosisUtils.signTransaction(lightWallet, owners, transactionHash)
    gnosisUtils.logGasUsage(
        'execTransaction dxModule.setup() from the Safe',
        await safeInstance.execTransaction(
            dxModuleAddress, 0, dxModuleSetupData, constants.CALL, 0, 0, 0, 0, 0, signatures
        )
    )
    // Lookup DutchX address on DX Module contract, it has to be equals to args.dutchx-address
    let lookupDutchxAddress = await dxSellerModuleInstance.dutchXAddress()
    console.log(`DutchX address setted ${lookupDutchxAddress.toLowerCase() == dutchxAddress.toLowerCase() ? 'correctly' : 'incorrectly'} on DX Module`)
    console.log("==========================================")
  } catch(error) {
    callback(error)
  }

  // Close script
  callback()
}
