var WhitelistModule = artifacts.require("./WhitelistModule.sol");

const notOwnedAddress = "0x0000000000000000000000000000000000000001"

module.exports = function(deployer) {
    deployer.deploy(WhitelistModule).then(function (module) {
        module.setup([])
        return module
    });
};
