
/*
 How to run the command
 ----------------------
 The script inherits a Web3 instance from Truffle, according to the configuration
 contained within truffle.js.

 - Using defaults, will use the configuration from truffle.js:
   npm run deploy-safe

- On a specific network:
   npm run deploy-safe -- --network rinkeby

 - By passing a mnemonic, will use the first 2 accounts as owners
   npm run deploy-safe -- --mnemonic 'myth like bonus scare over problem client lizard pioneer submit female collect'

 - By passing a seed and the accounts to add as a owners
   npm run deploy-safe -- \
     --mnemonic 'myth like bonus scare over problem client lizard pioneer submit female collect' \
     --owners '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1,0xffcf8fdee72ac11b5c542428b35eef5769c409f0,0x22d491bde2303f2f43325b2108d26f1eaba1e32b'

 - By passing a seed, the owners and the threshold explicitally
   npm run deploy-safe -- \
     --mnemonic 'myth like bonus scare over problem client lizard pioneer submit female collect' \
     --owners '0x800612b6c61883dd44d4e3e6e8f1a1a821ca5fe2,0xffcf8fdee72ac11b5c542428b35eef5769c409f0,0x22d491bde2303f2f43325b2108d26f1eaba1e32b' \
     --threshold 3

The `this` variable is an object containing a set of values inherited from Truffle.

*/

const args = require('yargs').argv
const nodeUtils = require('util')
const gnosisUtils = require('./utils')(this.web3) // Get web3 from injected global variables

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");

module.exports = async function(callback) {
  let accounts, owners, threshold

  if (!args.mnemonic) {
    console.log("Using Truffle Mnemonic configuration")
  } else {
    console.log("Provided mnemonic: " + args.mnemonic)
  }

  accounts = await nodeUtils.promisify(this.web3.eth.getAccounts)()

  // Check owners/accounts and set threshold
  if (!args.owners) {
    owners = [accounts[0], accounts[1]]
    threshold = 2
  } else {
    owners = args.owners.split(',')
    threshold = args.threshold || owners.length - 1
  }

  // Istantiate contracts
  console.log("Deploy ProxyFactory")
  let proxyFactory = await ProxyFactory.new()
  console.log("Address: " + proxyFactory.address)
  console.log("Deploy GnosisSafe master copy")
  let gnosisSafeMasterCopy = await GnosisSafe.new()
  console.log("Address: " + gnosisSafeMasterCopy.address)

  // Initialize safe master copy with number of confirmations defined by 'threshold'
  console.log("Execute GnosisSafe setup transaction")
  const setupTx = await gnosisSafeMasterCopy.setup(owners, threshold, 0, "0x")

  // Create Gnosis Safe
  let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData(owners, threshold, 0, "0x")
  console.log("Execute createProxy")
  let proxyInstance = await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData)

  gnosisSafe = gnosisUtils.getParamFromTxEvent(
      await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
      'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe',
  )

  const contractOwners = await gnosisSafe.getOwners()

  // Print generic info
  console.log("Owners: ".concat(contractOwners))
  console.log("Threshold: " + threshold)
  console.log("Safe address: " + gnosisSafe.address)

  // Close script
  callback()
}
