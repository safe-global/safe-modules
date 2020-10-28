const { deployTruffleContract } = require('@gnosis.pm/singleton-deployer-truffle');
const AllowanceModule = artifacts.require("AllowanceModule");

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployTruffleContract(web3, AllowanceModule);
  })
};
