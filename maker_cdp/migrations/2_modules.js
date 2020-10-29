const VaultLiquidationProtectionModule = artifacts.require("VaultLiquidationProtectionModule");

module.exports = function(deployer) {
  /**
   * All params are provided by command line
   * maker_vat_vault, 
   * cdp_owner, 
   * maker_dai_bridge,
   * maker_collateral_token_bridge, 
   * maker_colleteral_token_id, 
   * manager,
   * operator
   */
  const args = process.argv.slice()
  if(args.length != 9){
    console.log("you need to provide all constructor params: npx truffle migrate <maker_vat_vault> <cdp_owner> <maker_dai_bridge> <maker_colleteral_token_id> <manager> <operator>")
  }
  deployer.deploy(VaultLiquidationProtectionModule, args[3], args[4], args[5], args[6], args[7], args[8]);
};
