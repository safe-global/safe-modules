pragma solidity 0.5.0;
import "gnosis-safe/contracts/common/Enum.sol";
import "./DutchXBaseModule.sol";
import "./DutchXInterface.sol";
import "./DutchXTokenInterface.sol";


/// @title DutchX Module - Allows to execute transactions to DutchX contract for whitelisted token pairs without confirmations and deposit tokens in the DutchX.
//  differs from the Complete module in the allowed functions, it doesn't allow to perform buy operations.
/// @author Denis Granha - <denis@gnosis.pm>
contract DutchXSellerModule is DutchXBaseModule {

    string public constant NAME = "DutchX Seller Module";
    string public constant VERSION = "0.0.2";

    /// @dev Returns if Safe transaction is to DutchX contract and with whitelisted tokens.
    /// @param to Dutch X address or Whitelisted token (only for approve operations for DX).
    /// @param value Not checked.
    /// @param data Allowed operations (postSellOrder, postBuyOrder, claimTokensFromSeveralAuctionsAsBuyer, claimTokensFromSeveralAuctionsAsSeller, deposit).
    /// @return Returns if transaction can be executed.
    function executeWhitelisted(address to, uint256 value, bytes memory data)
        public
        returns (bool)
    {

        // Load allowed method interfaces
        DutchXTokenInterface tokenInterface;
        DutchXInterface dxInterface;

        // Only Safe owners are allowed to execute transactions to whitelisted accounts.
        require(isOperator[msg.sender], "Method can only be called by an operator");

        // Only DutchX Proxy and Whitelisted tokens are allowed as destination
        require(to == dutchXAddress || isWhitelistedToken[to], "Destination address is not allowed");

        // Decode data
        bytes4 functionIdentifier;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            functionIdentifier := mload(add(data, 0x20))
        }

        // Only approve tokens function and deposit (in the case of WETH) is allowed against token contracts, and DutchX proxy must be the spender (for approve)
        if (functionIdentifier != tokenInterface.deposit.selector){
            require(value == 0, "Eth transactions only allowed for wrapping ETH");
        }

        // Only these functions:
        // PostSellOrder, claimTokensFromSeveralAuctionsAsBuyer, claimTokensFromSeveralAuctionsAsSeller, deposit
        // Are allowed for the Dutch X contract
        if (functionIdentifier == tokenInterface.approve.selector) {
            uint spender;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                spender := mload(add(data, 0x24))
            }

            // TODO we need abi.decodeWithSelector
            // approve(address spender, uint256 amount) we skip the amount
            // (address spender) = abi.decode(dataParams, (address));

            require(address(spender) == dutchXAddress, "Spender must be the DutchX Contract");
        } else if (functionIdentifier == dxInterface.deposit.selector) {
            // TODO we need abi.decodeWithSelector
            // deposit(address token, uint256 amount) we skip the amount
            // (address token) = abi.decode(data, (address));

            uint depositToken;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                depositToken := mload(add(data, 0x24))
            }
            require (isWhitelistedToken[address(depositToken)], "Only whitelisted tokens can be deposit on the DutchX");
        } else if (functionIdentifier == dxInterface.postSellOrder.selector) {
            // TODO we need abi.decodeWithSelector
            // postSellOrder(address sellToken, address buyToken, uint256 auctionIndex, uint256 amount) we skip auctionIndex and amount
            // (address sellToken, address buyToken) = abi.decode(data, (address, address));

            uint sellToken;
            uint buyToken;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                sellToken := mload(add(data, 0x24))
                buyToken := mload(add(data, 0x44))
            }
            require (isWhitelistedToken[address(sellToken)] && isWhitelistedToken[address(buyToken)], "Only whitelisted tokens can be sold");
        } else {
            // Other functions different than claim and deposit are not allowed
            require(functionIdentifier == dxInterface.claimTokensFromSeveralAuctionsAsSeller.selector || functionIdentifier == dxInterface.claimTokensFromSeveralAuctionsAsBuyer.selector || functionIdentifier == tokenInterface.deposit.selector, "Function not allowed");
        }

        require(manager.execTransactionFromModule(to, value, data, Enum.Operation.Call), "Could not execute transaction");
    }
}
