/*
How to run the command
----------------------
The script inherits a Web3 instance from Truffle, according to the configuration
contained within truffle.js.

npm run print-info -- \
 --dx-module-address 0xab1234567137395f3c9744e33b1c5de554d94883

*/

const args = require('yargs').option('dx-module-address', {
  string: true
}).argv // ask argv to treat args as a string

const DutchXBaseModule = artifacts.require("./DutchXBaseModule")


module.exports = async function(callback) {
  let dxModuleAddress, dxModuleInstance

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
    console.log("============= DX MODULE INFO =============")

    const dutchXAddress = await dxModuleInstance.dutchXAddress()
    console.log(`DutchX Address: ${dutchXAddress}`)

    const manager = await dxModuleInstance.manager()
    console.log(`Manager Address: ${manager}`)

    console.log("==========================================")
  } catch (error) {
    callback(error)
  }

  // Close script
  callback()
}
