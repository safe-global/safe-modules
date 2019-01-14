/*
How to run the command
----------------------
The script inherits a Web3 instance from Truffle, according to the configuration
contained within truffle.js.

 npm run deploy-dx-module -- --mnemonic 'myth like bonus scare over problem client lizard pioneer submit female collect' \
 --safe 0x7e664541678c4997ad9dbdb9978c6e2b5a9445be \
 --dx-module 0x5017a545b09ab9a30499de7f431df0855bcb7275
 --whitelisted-tokens '0x4017a545b09ab9a30444de7f431df0855bcb7276,0x6017a545b09ab9a30300de7f431df0855bcb7277'

*/

const args = require('yargs').option('safe', {
  string: true
}).option('dx-module', {
  string: true
}).argv // ask argv to treat args as a string

const gnosisUtils = require('./utils')(this.web3)

const DutchXModule = artifacts.require("./DutchXModule.sol")
const GnosisSafe = artifacts.require("./GnosisSafe.sol")

const CALL = 0
const HEX_ZERO = '0x0000000000000000000000000000000000000000'

module.exports = async function(callback) {
  let dxModuleAddress, dxModuleInstance, owners, whitelistedTokens
  const mnemonic = args.mnemonic || this.web3.currentProvider.mnemonic

  if (!args.safe) {
    callback('Please provide --safe address')
  }

  if (!args.mnemonic) {
    console.log("Using Truffle Mnemonic configuration")
  } else {
    console.log("Provided mnemonic: " + args.mnemonic)
  }

  if (!args['dx-module']) {
    //callback('Please provide the DX module address')
    dxModuleInstance = await DutchXModule.new([])
    dxModuleAddress = dxModuleInstance.address
    console.log("DX Module address: " + dxModuleAddress)
  } else {
    console.log("Provided mnemonic: " + args.mnemonic)
    dxModuleAddress = args['dx-module']
    console.log(dxModuleAddress)
    dxModuleInstance = DutchXModule.at(dxModuleAddress)
  }

  if (!args['whitelisted-tokens']) {
    whitelistedTokens = []
  } else {
    whitelistedTokens = args['whitelisted-tokens'].split(',')
  }

  // Get DXModuleManager, if equals to HEX_ZERO, setup() must be called
  const manager = await dxModuleInstance.manager()
  const executeSetup = (manager == HEX_ZERO)

  // Get Safe instance
  console.log("Getting GnosisSafe info...")
  let safeInstance = GnosisSafe.at(args.safe)
  owners = await safeInstance.getOwners()
  // Print safe info
  console.log('Safe: ' + args.safe)
  console.log('Owners: ' + owners)

  if (executeSetup) {
    //let dxModuleSetupData = await dxModuleInstance.contract.setup.getData(dxModuleAddress, whitelistedTokens, owners) // dx, whitelistedToken, operators
    console.log("Execute dxModule.setup(dxModuleAddress, whitelistedTokens, owners) ...")
    await dxModuleInstance.setup(dxModuleAddress, whitelistedTokens, owners)
  }

  const enableModuleData = await safeInstance.contract.enableModule.getData(dxModuleAddress)
  console.log("Get Safe instance nonce...")
  const nonce = await safeInstance.nonce()
  console.log("Nonce: " + nonce)

  console.log("Calculate transaction hash, safeInstance.getTransactionHash(...) ...")
  let transactionHash = await safeInstance.getTransactionHash(safeInstance.address, 0, enableModuleData, CALL, 0, 0, 0, 0, 0, nonce)
  console.log("Transaction hash: " + transactionHash)

  console.log("Sign transaction...")
  // Truffle uses the HTTPPRovider When on LOCALHOST, so we need to pass the mnemonic seed via command
  const lightWallet = await gnosisUtils.createLightwallet(mnemonic)
  let signatures = gnosisUtils.signTransaction(lightWallet, owners, transactionHash)
  console.log("Signatures: " + signatures)

  gnosisUtils.logGasUsage(
      'execTransaction add module',
      await safeInstance.execTransaction(
          safeInstance.address, 0, enableModuleData, CALL, 0, 0, 0, 0, 0, signatures
      )
  )

  // Get safe modules
  const modules = await safeInstance.getModules()
  console.log("Modules: " + modules)

  // Close script
  callback()
}
