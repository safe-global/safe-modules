/*
How to run the command
----------------------
The script inherits a Web3 instance from Truffle, according to the configuration
contained within truffle.js.

npm run enable-dx-module -- \
 --mnemonic 'myth like bonus scare over problem client lizard pioneer submit female collect' \
 --safe-address 0xfc628dd79137395f3c9744e33b1c5de554d94882 \
 --dx-module-address 0xab1234567137395f3c9744e33b1c5de554d94883

*/

const args = require('yargs').option('dx-module-address', {
  string: true
}).option('safe-address', {
  string: true
}).argv // ask argv to treat args as a string

const gnosisUtils = require('../utils')(this.web3)
const constants = require('../constants')

const DutchXBaseModule = artifacts.require("./DutchXBaseModule")
const GnosisSafe = artifacts.require("./GnosisSafe.sol")


module.exports = async function(callback) {
  let dxModuleAddress, dxModuleInstance, safeAddress

  const mnemonic = args.mnemonic || this.web3.currentProvider.mnemonic

  if (!args.mnemonic) {
    console.log("Using Truffle Mnemonic configuration")
  } else {
    console.log("Provided mnemonic: " + args.mnemonic)
  }

  // Check args

  if (!args['dx-module-address']) {
    callback('--dx-module-address argument not provided. Please provide the Safe DX module address')
  } else {
    try {
      // Instantiate the Safe Module DutchX contract
      dxModuleAddress = args['dx-module-address']
      dxModuleInstance = DutchXBaseModule.at(dxModuleAddress)
    } catch(error) {
      callback(error)
    }
  }

  try {
    if (args['safe-address']) {
      safeAddress = args['safe-address']
    } else {
      safeAddress = await dxModuleInstance.manager()
    }

    // Truffle uses the HTTPPRovider When on LOCALHOST, so we need to pass the mnemonic seed via command
    const lightWallet = await gnosisUtils.createLightwallet(mnemonic)

    // Get Safe instance
    console.log("Getting GnosisSafe instance...")
    const safeInstance = GnosisSafe.at(safeAddress)
    const safeOwners = await safeInstance.getOwners()

    console.log("============= SAFE EXECUTION =============")
    console.log("Get data safeInstance.enableModule(dxModuleAddress) ...")
    const enableModuleData = await safeInstance.contract.enableModule.getData(dxModuleAddress)

    console.log("Get Safe instance nonce...")
    const nonce = await safeInstance.nonce()
    console.log(`Safe Nonce: ${nonce}`)

    console.log("Calculate transaction hash, safeInstance.getTransactionHash(...) ...")
    const transactionHash = await safeInstance.getTransactionHash(safeInstance.address, 0, enableModuleData, constants.CALL, 0, 0, 0, 0, 0, nonce)
    console.log(`Transaction hash: ${transactionHash}`)
    console.log("Sign transaction...")
    const signatures = gnosisUtils.signTransaction(lightWallet, safeOwners, transactionHash)
    gnosisUtils.logGasUsage(
        'execTransaction add module',
        await safeInstance.execTransaction(
            safeInstance.address, 0, enableModuleData, constants.CALL, 0, 0, 0, 0, 0, signatures
        )
    )

    // Get safe modules
    const modules = await safeInstance.getModules()
    console.log(`Modules: ${modules}`)
    console.log("==========================================")
  } catch (error) {
    callback(error)
  }

  // Close script
  callback()
}
