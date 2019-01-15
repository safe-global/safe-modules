/*
How to run the command
----------------------
The script inherits a Web3 instance from Truffle, according to the configuration
contained within truffle.js.

 npm run deploy-dx-module -- --mnemonic 'myth like bonus scare over problem client lizard pioneer submit female collect' \
 --safe 0x7e664541678c4997ad9dbdb9978c6e2b5a9445be \
 --dx-module-address 0x5017a545b09ab9a30499de7f431df0855bcb7275 (optional if --create-dx provided)
 --dx-module-type [complete, seller]
 --whitelisted-tokens '0x4017a545b09ab9a30444de7f431df0855bcb7276,0x6017a545b09ab9a30300de7f431df0855bcb7277' (optional)
 --create-dx (optional)

*/

const args = require('yargs').option('safe', {
  string: true
}).option('dx-module-address', {
  string: true
}).argv // ask argv to treat args as a string

const constants = require('./constants')
const gnosisUtils = require('./utils')(this.web3)


// Contracts
const DutchXCompleteModule = artifacts.require("./DutchXCompleteModule.sol")
const DutchXSellerModule = artifacts.require("./DutchXSellerModule.sol")
const GnosisSafe = artifacts.require("./GnosisSafe.sol")

module.exports = async function(callback) {
  let dxContractType, dxModuleAddress, dxModuleInstance, owners, whitelistedTokens
  const mnemonic = args.mnemonic || this.web3.currentProvider.mnemonic

  const dxContracts = {
    'complete': DutchXCompleteModule,
    'seller': DutchXSellerModule
  }

  // Check args

  if (!args.safe) {
    callback('--safe argument not provided. Please provide the Safe address')
  }

  if (args['dx-module-type'] && dxContracts[args['dx-module-type']]) {
    dxContractType = args['dx-module-type']
  } else {
    callback(`--dx-module-type ${args['dx-module-type']} is not a valid option: [${Object.keys(dxContracts)}]`)
  }

  if (!args.mnemonic) {
    console.log("Using Truffle Mnemonic configuration")
  } else {
    console.log(`Provided mnemonic: ${args.mnemonic}`)
  }

  if (!args['whitelisted-tokens']) {
    whitelistedTokens = []
  } else {
    whitelistedTokens = args['whitelisted-tokens'].split(',')
  }

  if (!args['dx-module-address'] && !args['create-dx']) {
    callback('--dx-module-address argument not provided. Please provide the DX module address or --create-dx to deploy a new module')
  } else if (args['create-dx']) {
    try {
      // Deploy the contract accordingly to its type
      console.log(`Deploy DutchX ${dxContractType} module...`)
      if (dxContractType == 'complete') {
        dxModuleInstance = await DutchXCompleteModule.new([])
      } else if (dxContractType == 'seller') {
        dxModuleInstance = await DutchXSellerModule.new([])
      }
      dxModuleAddress = dxModuleInstance.address
    } catch(error) {
      callback(error)
    }
  } else {
    try {
      // Get an instance of the DutchX contract according to its type
      if (dxContractType == 'complete') {
        dxModuleAddress = args['dx-module-address']
        dxModuleInstance = DutchXCompleteModule.at(dxModuleAddress)
      } else if (dxContractType == 'seller') {
        dxModuleAddress = args['dx-module-address']
        dxModuleInstance = DutchXSellerModule.at(dxModuleAddress)
      }
    } catch(error) {
      callback(error)
    }
  }

  // Truffle uses the HTTPPRovider When on LOCALHOST, so we need to pass the mnemonic seed via command
  const lightWallet = await gnosisUtils.createLightwallet(mnemonic)

  // Get DXModuleManager, if equals to HEX_ZERO, setup() must be called
  let manager = await dxModuleInstance.manager()
  const executeSetup = (manager == constants.HEX_ZERO)

  console.log("============ SAFE INFO =============")
  // Get Safe instance
  let safeInstance = GnosisSafe.at(args.safe)
  owners = await safeInstance.getOwners()
  // Print safe info
  console.log('Safe: ' + args.safe)
  console.log('Owners: ' + owners)
  console.log('Manager: ' + manager)
  console.log("==========================================")

  let nonce, signatures, transactionHash

  if (executeSetup) {
    try {
      console.log(`=========== DX ${dxContractType.toUpperCase()} MODULE SETUP ==============`)
      console.log(`DX Module address: ${dxModuleAddress}`)
      console.log("Get data dxModule.setup(dxModuleAddress, whitelistedTokens, owners) ...")
      let dxModuleSetupData = await dxModuleInstance.contract.setup.getData(dxModuleAddress, whitelistedTokens, owners)
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
      console.log("==========================================")
    } catch(error) {
      callback(error)
    }
  }

  try {
    console.log("============= SAFE EXECUTION =============")
    console.log("Get data safeInstance.enableModule(dxModuleAddress) ...")
    const enableModuleData = await safeInstance.contract.enableModule.getData(dxModuleAddress)
    console.log("Get Safe instance nonce...")
    nonce = await safeInstance.nonce()
    console.log(`Safe Nonce: ${nonce}`)
    console.log("Calculate transaction hash, safeInstance.getTransactionHash(...) ...")
    transactionHash = await safeInstance.getTransactionHash(safeInstance.address, 0, enableModuleData, constants.CALL, 0, 0, 0, 0, 0, nonce)
    console.log(`Transaction hash: ${transactionHash}`)
    console.log("Sign transaction...")
    signatures = gnosisUtils.signTransaction(lightWallet, owners, transactionHash)
    gnosisUtils.logGasUsage(
        'execTransaction add module',
        await safeInstance.execTransaction(
            safeInstance.address, 0, enableModuleData, constants.CALL, 0, 0, 0, 0, 0, signatures
        )
    )

    // Get safe modules
    const modules = await safeInstance.getModules()
    console.log(`Modules: ${modules}`)

    manager = await dxModuleInstance.manager()
    console.log(`Manager: ${manager}`)
    console.log("==========================================")
  } catch (error) {
    callback(error)
  }

  // Close script
  callback()
}
