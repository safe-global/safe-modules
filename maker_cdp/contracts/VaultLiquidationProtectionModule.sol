// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.6.0 <0.7.0;

import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";
import "@gnosis.pm/safe-contracts/contracts/base/Module.sol";

contract VaultLiquidationProtectionModule is Module{

    string public constant NAME = "Vault Liquidation Protection Module";
    string public constant VERSION = "0.1.0";

    address public immutable maker_vat_vault; // vat contract, Maker Vault core contract
    address public immutable cdp_owner; // also called urn in the vat contract
    address public immutable maker_dai_bridge; // DAI adapter contract of Maker DAO used to interact with vat contract
    address public immutable maker_collateral_token_bridge; // Collateral Token Adapter contract, also called gem
    bytes32 public immutable maker_colleteral_token_id; // Collateral Token ID in Maker DAO system, also called ILK
    address public immutable operator; // EOA used to interact with this module

    modifier onlyOperator {
        require(msg.sender == operator, "Only the operator can call this function");
        _;
    }

    constructor(
        address _maker_vat_vault, 
        address _cdp_owner, 
        address _maker_dai_bridge, 
        address _maker_collateral_token_bridge, 
        bytes32 _maker_colleteral_token_id, 
        address _manager,
        address _operator
    ) public {
        maker_vat_vault                 = _maker_vat_vault;
        cdp_owner                       = _cdp_owner;
        maker_dai_bridge                = _maker_dai_bridge;
        maker_collateral_token_bridge   = _maker_collateral_token_bridge;
        maker_colleteral_token_id       = _maker_colleteral_token_id;
        manager                         = ModuleManager(_manager);
        operator                        = _operator;
    }

    function increase_cdp_collateralisation(
        int256 collateral_amount, int256 dai_amount
    ) public onlyOperator {

        // This two checks prevent accidentally decreasing collateralization in the CDP and cause a liquidation
        // In theory it's assumed that the safe used for this module shouldn't be the owner of the CDP
        // But this prevents liquidation in case the safe it's the owner
        require(collateral_amount >= 0, "Collateral amount must increase collateralization");
        require(dai_amount <= 0, "DAI amount must decrease CDP debt");
        
        if(collateral_amount != 0){
            // Collateral has to be moved first into the Maker system
            // Reference: https://github.com/makerdao/dss/blob/1.1.2/src/join.sol#L89
            bytes memory collateral_join_data = abi.encodeWithSignature(
                "join(address,uint256)", 
                manager, 
                uint256(collateral_amount)
            );

            require(
                manager.execTransactionFromModule(
                    maker_collateral_token_bridge, 
                    0, 
                    collateral_join_data, 
                    Enum.Operation.Call
                ), "Could not execute collateral transfer"
            );
        }

        if(dai_amount != 0){

            // DAI has to be moved first into the Maker system
            // Reference: https://github.com/makerdao/dss/blob/1.1.2/src/join.sol#L129
            bytes memory dai_join_data = abi.encodeWithSignature(
                "join(address,uint256)", 
                manager, 
                uint256(-dai_amount)
            );

            require(
                manager.execTransactionFromModule(
                    maker_dai_bridge, 
                    0, 
                    dai_join_data,
                    Enum.Operation.Call
                ), "Could not execute DAI transfer"
            );
        }

        // frob function modifies debt and collateral amounts in the DAI CDP
        // Reference: https://github.com/makerdao/dss/blob/1.1.2/src/vat.sol#L165
        bytes memory cdp_deposit_data = abi.encodeWithSignature(
            "frob(bytes32,address,address,address,int256,int256)", 
            maker_colleteral_token_id,
            cdp_owner,
            manager,
            manager,
            collateral_amount,
            dai_amount
        );
        require(
            manager.execTransactionFromModule(
                    maker_vat_vault, 
                    0, 
                    cdp_deposit_data,
                    Enum.Operation.Call
                ), "Could not execute CDP Deposit"
        );


    }

}