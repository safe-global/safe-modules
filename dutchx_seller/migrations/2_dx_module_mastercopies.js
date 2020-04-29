var CompleteModule = artifacts.require("./DutchXCompleteModule.sol");
var SellerModule = artifacts.require("./DutchXSellerModule.sol");

const notOwnedAddress = "0x0000000000000000000000000000000000000001"

module.exports = function(deployer) {
    deployer.deploy(CompleteModule).then(function (dxCompleteModule) {
        dxCompleteModule.setup(notOwnedAddress, [], [], notOwnedAddress)
        return dxCompleteModule
    });
    deployer.deploy(SellerModule).then(function (dxSellerModule) {
        dxSellerModule.setup(notOwnedAddress, [], [], notOwnedAddress)
        return dxSellerModule
    });
};
