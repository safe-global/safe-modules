// TODO specify numbers of users or users addresses parameter and threshold via command line

const Web3 = require('web3')
// istantiate web3
const web3 = new Web3()

const utils = require('./utils')(web3)

const CreateAndAddModules = artifacts.require("./CreateAndAddModules.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");

module.exports = async function(callback) {
  // Create lightwallet
  lw = await utils.createLightwallet()
  const accounts = lw.accounts
  // Istantiate contracts
  let proxyFactory = await ProxyFactory.new()
  let createAndAddModules = await CreateAndAddModules.new()
  let gnosisSafeMasterCopy = await GnosisSafe.new()

  // Initialize safe master copy with accounts[0] and accounts[1] as owners and 2 required confirmations
  gnosisSafeMasterCopy.setup([accounts[0], accounts[1]], 2, 0, "0x")

  // Create Gnosis Safe
  let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, "0x")
  let proxyInstance = await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData)

  gnosisSafe = utils.getParamFromTxEvent(
      await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
      'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe',
  )

  console.log("Safe address: " + gnosisSafe.address)

  callback()
}
