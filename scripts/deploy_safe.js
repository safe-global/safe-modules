
/*
 How to run the command
 ----------------------

 - Using defaults, will generate a random seed and accounts:
   npm run deploy-safe
 - By passing a seed, will use the first 2 accounts as owners
   npm run deploy-safe -- --seed 'embrace oblige enemy live screen stem match fall answer pink afraid impulse'

 - By passing a seed and the accounts to add as a owners
   npm run deploy-safe -- --seed 'embrace oblige enemy live screen stem match fall answer pink afraid impulse' \
     --owners '0x800612b6c61883dd44d4e3e6e8f1a1a821ca5fe2,0xa54df3627c7f162ff533377ee353baf9ac8fbf1b,0x8f788b2a8f87e6083db5d8a0d8d0dff898e2a0c0'

 - By passing a seed, the owners and the threshold explicitally
   npm run deploy-safe -- --seed 'embrace oblige enemy live screen stem match fall answer pink afraid impulse' \
     --owners '0x800612b6c61883dd44d4e3e6e8f1a1a821ca5fe2,0xa54df3627c7f162ff533377ee353baf9ac8fbf1b,0x8f788b2a8f87e6083db5d8a0d8d0dff898e2a0c0' \
     --threshold 3
*/

const args = require('yargs').argv;
const Web3 = require('web3')
// istantiate web3
const web3 = new Web3()

const utils = require('./utils')(web3)

const CreateAndAddModules = artifacts.require("./CreateAndAddModules.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");

module.exports = async function(callback) {
  let seedPhrase, accounts, lightWallet, owners, threshold

  if (!args.seed) {
    seedPhrase = utils.createRandomSeed()
  } else {
    seedPhrase = args.seed
  }

  // Create lightwallet/Restore lightWallet
  lightWallet = await utils.createLightwallet(seedPhrase)
  accounts = lightWallet.accounts

  // Check owners/accounts and set threshold
  if (!args.owners || !args.seed) {
    owners = [accounts[0], accounts[1]]
    threshold = 2
  } else {
    owners = args.owners.split(',')
    threshold = args.threshold || owners.length - 1
  }

  // Istantiate contracts
  let proxyFactory = await ProxyFactory.new()
  let createAndAddModules = await CreateAndAddModules.new()
  let gnosisSafeMasterCopy = await GnosisSafe.new()

  // Initialize safe master copy with number of confirmations defined by 'threshold'
  gnosisSafeMasterCopy.setup(owners, threshold, 0, "0x")

  // Create Gnosis Safe
  let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData(owners, threshold, 0, "0x")
  let proxyInstance = await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData)
  gnosisSafe = utils.getParamFromTxEvent(
      await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
      'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe',
  )

  // Print info
  console.log("Seed: " + seedPhrase)
  console.log("Owners: ".concat(owners))
  console.log("Threshold: " + threshold)
  console.log("Safe address: " + gnosisSafe.address)

  // Close script
  callback()
}
