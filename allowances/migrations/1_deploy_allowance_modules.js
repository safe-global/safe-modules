const { deployTruffleContract } = require("@gnosis.pm/singleton-deployer-truffle")
const AllowanceModule = artifacts.require("AllowanceModule")

// Safe singleton factory was deployed using eip155 transaction
// If the network enforces EIP155, then the safe singleton factory should be used
// More at https://github.com/gnosis/safe-singleton-factory
const USE_SAFE_SINGLETON_FACTORY = process.env.USE_SAFE_SINGLETON_FACTORY === "true"

module.exports = function (deployer) {
  deployer.then(async () => {
    await deployTruffleContract(web3, AllowanceModule, USE_SAFE_SINGLETON_FACTORY)
  })
}
