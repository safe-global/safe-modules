const AllowanceModule = artifacts.require("AllowanceModule");

module.exports = function(deployer) {
  deployer.deploy(AllowanceModule);
};
