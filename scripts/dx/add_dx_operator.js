/*
How to run the command
----------------------
The script inherits a Web3 instance from Truffle, according to the configuration
contained within truffle.js.

npm run add-dx-operator -- \
 --mnemonic 'myth like bonus scare over problem client lizard pioneer submit female collect' \
 --dx-module-address 0xfc628dd79137395f3c9744e33b1c5de554d94882 \
 --operator-address 0xb09bcc172050fbd4562da8b229cf3e45dc3045a6

*/

const args = require('yargs').option('dx-module-address', {
  string: true
}).option('operator-address', {
  string: true
}).argv // ask argv to treat args as a string

const gnosisUtils = require('../utils')(this.web3)
const constants = require('../constants')

const DutchXBaseModule = artifacts.require("./DutchXBaseModule")
const GnosisSafe = artifacts.require("./GnosisSafe.sol")


module.exports = async function(callback) {
  let dxModuleAddress, dxModuleInstance, operatorAddress

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

  if (!args['operator-address']) {
    callback('--operator-address argument not provided. Please provide the DutchX operator address')
  } else {
    operatorAddress = args['operator-address']
  }

  // Get the value of dxModule manager
  let isOperator = await dxModuleInstance.isOperator(operatorAddress)

  if (isOperator == true) {
    callback(`Address ${operatorAddress} is already listed as an operator, no further action is required.`)
  }

  // Truffle uses the HTTPPRovider When on LOCALHOST, so we need to pass the mnemonic seed via command
  const lightWallet = await gnosisUtils.createLightwallet(mnemonic)

  // Get the value of dxModule manager
  const manager = await dxModuleInstance.manager()

  // Get Safe instance
  console.log("Getting GnosisSafe instance...")
  const safeInstance = GnosisSafe.at(manager)
  const safeOwners = await safeInstance.getOwners()

  try {
    console.log("Get Data dxModule.addOperator(address) from Safe ...")
    let dxModuleData = await dxModuleInstance.contract.addOperator.getData(operatorAddress)
    console.log("Get Safe instance nonce...")
    let nonce = await safeInstance.nonce()
    console.log(`Nonce: ${nonce}`)
    console.log("Calculate transaction hash, safeInstance.getTransactionHash(...) ...")
    let transactionHash = await safeInstance.getTransactionHash(dxModuleAddress, 0, dxModuleData, constants.CALL, 0, 0, 0, 0, 0, nonce)
    console.log("Sign transaction...")
    signatures = gnosisUtils.signTransaction(lightWallet, safeOwners, transactionHash)
    gnosisUtils.logGasUsage(
        'execTransaction dxModule.addOperator()',
        await safeInstance.execTransaction(
            dxModuleAddress, 0, dxModuleData, constants.CALL, 0, 0, 0, 0, 0, signatures
        )
    )

  } catch (error) {
    callback(error)
  }

  isOperator = await dxModuleInstance.isOperator(operatorAddress)
  console.log(`Address is now an operator: ${isOperator}`)

  // Close script
  callback()
}
