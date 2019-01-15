
/*
 How to run the command
 ----------------------
 The script inherits a Web3 instance from Truffle, according to the configuration
 contained within truffle.js.

 - Using defaults, will use the configuration from truffle.js:
   npm run deploy-safe

- On a specific network:
   npm run deploy-safe -- --network rinkeby

- By using a specific master copy address and ProxyFactory:
  npm run deploy-safe -- --master-copy 0x5b1869d9a4c187f2eaa108f3062412ecf0526b24 \
  --proxy-factory 0xe78a0f7e598cc8b0bb87894b0f60dd2a88d6a8ab

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

const args = require('yargs').option('master-copy', {
  string: true
}).option('proxy-factory', {
  string: true
}).argv
const gnosisUtils = require('./utils')(this.web3) // Get web3 from injected global variables
const nodeUtils = require('util')

// Contracts
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");

module.exports = async function(callback) {
  let accounts, owners, threshold, masterCopyAddress, masterCopyInstance, proxyFactoryAddress, proxyFactoryInstance

  if (!args.mnemonic) {
    console.log("Using Truffle Mnemonic configuration")
  } else {
    console.log("Provided mnemonic: " + args.mnemonic)
  }

  masterCopyAddress = args['master-copy']
  proxyFactoryAddress = args['proxy-factory']
  accounts = await nodeUtils.promisify(this.web3.eth.getAccounts)()

  // Check owners/accounts and set threshold
  if (!args.owners) {
    owners = [accounts[0], accounts[1]]
    threshold = 2
  } else {
    owners = args.owners.split(',')
    threshold = args.threshold || owners.length - 1
  }

  if (!proxyFactoryAddress) {
    // Istantiate contracts
    console.log("Deploy ProxyFactory")
    proxyFactoryInstance = await ProxyFactory.new()
    console.log("Proxy factory address: " + proxyFactoryInstance.address)
  } else {
    console.log("Get ProxyFactory instance at " + proxyFactoryAddress)
    proxyFactoryInstance = ProxyFactory.at(proxyFactoryAddress)
  }

  let gnosisSafe, gnosisSafeData

  // TODO master copy address is the same on Mainnet and on other networks
  // except for ganache, we can hard-code its value to avoid errors when using
  // mainnet/rinkeby
  if (!masterCopyAddress) {
    console.log("Deploy GnosisSafe master copy")
    masterCopyInstance = await GnosisSafe.new()
    console.log("Master copy address: " + masterCopyInstance.address)
  } else {
    console.log("Get GnosisSafe master copy instance at " + masterCopyAddress)
    masterCopyInstance = GnosisSafe.at(masterCopyAddress)
  }

  // Create Gnosis Safe
  gnosisSafeData = await masterCopyInstance.contract.setup.getData(owners, threshold, 0, "0x")
  console.log("Execute createProxy")
  let proxyInstance = await proxyFactoryInstance.createProxy(masterCopyInstance.address, gnosisSafeData)
  let proxyAddress = proxyInstance.logs[0].args.proxy
  gnosisSafe = GnosisSafe.at(proxyAddress)

  const contractOwners = await gnosisSafe.getOwners()

  // Print generic info
  console.log("Owners: ".concat(contractOwners))
  console.log("Threshold: " + threshold)
  console.log("Safe address: " + gnosisSafe.address)

  // Close script
  callback()
}
