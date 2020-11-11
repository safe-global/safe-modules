const VaultLiquidationProtectionModule = artifacts.require("VaultLiquidationProtectionModule");
const {makerVatVault, cdpOwner, makerDaiBridge, makerCollateralTokenBridge, makerCollateralTokenId, manager, operator} = require("../config.js")


module.exports = function(deployer) {
  /**
   * All params are provided by the config.js file
   * maker_vat_vault, 
   * cdp_owner, 
   * maker_dai_bridge,
   * maker_collateral_token_bridge, 
   * maker_colleteral_token_id, 
   * manager,
   * operator
   */
  deployer.deploy(VaultLiquidationProtectionModule, makerVatVault, cdpOwner, makerDaiBridge, makerCollateralTokenBridge, makerCollateralTokenId, manager, operator);
};
