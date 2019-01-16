/*
How to run the command
----------------------
The script inherits a Web3 instance from Truffle, according to the configuration
contained within truffle.js.

npm run remove-dx-whitelisted-token -- \
 --mnemonic 'myth like bonus scare over problem client lizard pioneer submit female collect'
 --token 0xb09bcc172050fbd4562da8b229cf3e45dc3045a6 \
 --dx-module-address 0xfc628dd79137395f3c9744e33b1c5de554d94882
 --dx-module-type complete [complete, seller]

*/

const args = require('yargs').option('dx-module-address', {
  string: true
}).option('token', {
  string: true
}).argv // ask argv to treat args as a string

const gnosisUtils = require('./utils')(this.web3)
const constants = require('./constants')

const DutchXCompleteModule = artifacts.require("./DutchXCompleteModule.sol")
const DutchXSellerModule = artifacts.require("./DutchXSellerModule.sol")
const GnosisSafe = artifacts.require("./GnosisSafe.sol")


module.exports = async function(callback) {
  let dxContractType, dxModuleAddress, dxModuleInstance, tokenAddress

  const dxContracts = {
    'complete': DutchXCompleteModule,
    'seller': DutchXSellerModule
  }

  const mnemonic = args.mnemonic || this.web3.currentProvider.mnemonic

  if (!args.mnemonic) {
    console.log("Using Truffle Mnemonic configuration")
  } else {
    console.log("Provided mnemonic: " + args.mnemonic)
  }

  // Check args

  if (args['dx-module-type'] && dxContracts[args['dx-module-type']]) {
    dxContractType = args['dx-module-type']
  } else {
    callback(`--dx-module-type ${args['dx-module-type']} is not a valid option: [${Object.keys(dxContracts)}]`)
  }

  if (!args['token']) {
    callback('--token argument not provided. Please provide the token address')
  } else {
    tokenAddress = args.token
  }

  if (!args['dx-module-address']) {
    callback('--dx-module-address argument not provided. Please provide the DX module address')
  } else {
    try {
      // Instantiate the DutchX contract according to its type
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

  // Get the value of dxModule manager
  const manager = await dxModuleInstance.manager()

  // Truffle uses the HTTPPRovider When on LOCALHOST, so we need to pass the mnemonic seed via command
  const lightWallet = await gnosisUtils.createLightwallet(mnemonic)

  // Get Safe instance
  console.log("Getting GnosisSafe instance...")
  const safeInstance = GnosisSafe.at(manager)
  const owners = await safeInstance.getOwners()

  // Check if token is already whitelisted
  let isWhitelistedToken = await dxModuleInstance.isWhitelistedToken(tokenAddress)

  if (!isWhitelistedToken) {
    // No needs to go forward
    callback('Token is not whitelisted')
  }

  try {
    console.log("Get data dxModule.removeFromWhitelist(token) ...")
    let dxModuleData = await dxModuleInstance.contract.removeFromWhitelist.getData(tokenAddress)
    console.log("Get Safe instance nonce...")
    let nonce = await safeInstance.nonce()
    console.log(`Nonce: ${nonce}`)
    console.log("Calculate transaction hash, safeInstance.getTransactionHash(...) ...")
    let transactionHash = await safeInstance.getTransactionHash(dxModuleAddress, 0, dxModuleData, constants.CALL, 0, 0, 0, 0, 0, nonce)
    console.log("Sign transaction...")
    signatures = gnosisUtils.signTransaction(lightWallet, owners, transactionHash)
    gnosisUtils.logGasUsage(
        'execTransaction dxModule.removeFromWhitelist()',
        await safeInstance.execTransaction(
            dxModuleAddress, 0, dxModuleData, constants.CALL, 0, 0, 0, 0, 0, signatures
        )
    )

  } catch (error) {
    callback(error)
  }

  isWhitelistedToken = await dxModuleInstance.isWhitelistedToken(tokenAddress)
  console.log(`Token whitelisted: ${isWhitelistedToken}`)

  // Close script
  callback()
}
