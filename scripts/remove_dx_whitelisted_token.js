/*
How to run the command
----------------------
The script inherits a Web3 instance from Truffle, according to the configuration
contained within truffle.js.

npm run remove-dx-whitelisted-token -- \
 --mnemonic 'myth like bonus scare over problem client lizard pioneer submit female collect'
 --token 0xb09bcc172050fbd4562da8b229cf3e45dc3045a6 \
 --dx-module 0xfc628dd79137395f3c9744e33b1c5de554d94882

*/

const args = require('yargs').option('dx-module', {
  string: true
}).option('token', {
  string: true
}).argv // ask argv to treat args as a string

const gnosisUtils = require('./utils')(this.web3)

const DutchXModule = artifacts.require("./DutchXModule.sol")

module.exports = async function(callback) {
  let dxModuleAddress, dxModuleInstance, tokenAddress

  if (!args['dx-module']) {
    callback('Please provide the DX module address')
  } else {
    dxModuleAddress = args['dx-module']
    dxModuleInstance = DutchXModule.at(dxModuleAddress)
  }

  if (!args['token']) {
    callback('Please provide the --token argument')
  } else {
    tokenAddress = args.token
  }

  // Check if token is already whitelisted
  let isWhitelistedToken = await dxModuleInstance.isWhitelistedToken(tokenAddress)

  if (!isWhitelistedToken) {
    callback('Token is not whitelisted')
  }

  try {
    console.log("Execute dxModule.addToWhitelist(token) ...")
    await dxModuleInstance.removeFromWhitelist(tokenAddress)
  } catch (error) {
    callback(error)
  }

  isWhitelistedToken = await dxModuleInstance.isWhitelistedToken(tokenAddress)
  console.log("Token whitelisted: " + isWhitelistedToken)

  // Close script
  callback()
}
