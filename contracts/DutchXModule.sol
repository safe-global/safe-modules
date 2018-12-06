pragma solidity 0.5.0;
import "gnosis-safe/contracts/base/Module.sol";
import "gnosis-safe/contracts/base/ModuleManager.sol";
import "gnosis-safe/contracts/base/OwnerManager.sol";
import "gnosis-safe/contracts/common/Enum.sol";
import "./DutchXInterface.sol";
import "./DutchXTokenInterface.sol";



/// @title DutchX Module - Allows to execute transactions to DutchX contract for whitelisted token pairs without confirmations and deposit tokens in the DutchX.
/// @author Denis Granha - <denis@gnosis.pm>
contract DutchXModule is Module {

    string public constant NAME = "DutchX Module";
    string public constant VERSION = "0.0.2";

    // // Whitelisted token functions
    // bytes32 public constant APPROVE_TOKEN_FUNCTION_IDENTIFIER = hex"095ea7b3";
    // bytes32 public constant DEPOSIT_WETH_FUNCTION_IDENTIFIER = hex"d0e30db0";
    // // Whitelisted dx functions
    // bytes32 public constant DEPOSIT_DX_FUNCTION_IDENTIFIER = hex"47e7ef24";
    // bytes32 public constant POST_SELL_DX_FUNCTION_IDENTIFIER = hex"59f96ae5";
    // bytes32 public constant POST_BUY_DX_FUNCTION_IDENTIFIER = hex"5e7f22c2";
    // bytes32 public constant CLAIM_SELLER_DX_FUNCTION_IDENTIFIER = hex"7895dd21";
    // bytes32 public constant CLAIM_BUYER_DX_FUNCTION_IDENTIFIER = hex"d3cc8d1c";
    
    address public dutchXAddress;
    // isWhitelistedToken mapping maps destination address to boolean.
    mapping (address => bool) public isWhitelistedToken;
    mapping (address => bool) public isOperator;

    /// @dev Setup function sets initial storage of contract.
    /// @param dx DutchX Proxy Address.
    /// @param tokens List of whitelisted tokens.
    function setup(address dx, address[] memory tokens, address[] memory operators)
        public
    {
        setManager();
        dutchXAddress = dx;
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            require(token != address(0), "Invalid token provided");
            isWhitelistedToken[token] = true;
        }
        for (uint256 i = 0; i < operators.length; i++) {
            address operator = operators[i];
            require(operator != address(0), "Invalid operator address provided");
            isOperator[operator] = true;
        }
    }

    /// @dev Allows to add token to whitelist. This can only be done via a Safe transaction.
    /// @param token ERC20 token address.
    function addToWhitelist(address token)
        public
        authorized
    {
        require(token != address(0), "Invalid token provided");
        require(!isWhitelistedToken[token], "Token is already whitelisted");
        isWhitelistedToken[token] = true;
    }

    /// @dev Allows to remove token from whitelist. This can only be done via a Safe transaction.
    /// @param token ERC20 token address.
    function removeFromWhitelist(address token)
        public
        authorized
    {
        require(isWhitelistedToken[token], "Token is not whitelisted");
        isWhitelistedToken[token] = false;
    }

    /// @dev Allows to add operator to whitelist. This can only be done via a Safe transaction.
    /// @param operator ethereum address.
    function addOperator(address operator)
        public
        authorized
    {
        require(operator != address(0), "Invalid address provided");
        require(!isOperator[operator], "Operator is already whitelisted");
        isOperator[operator] = true;
    }

    /// @dev Allows to remove operator from whitelist. This can only be done via a Safe transaction.
    /// @param operator ethereum address.
    function removeOperator(address operator)
        public
        authorized
    {
        require(isOperator[operator], "Operator is not whitelisted");
        isOperator[operator] = false;
    }

    /// @dev Allows to change DutchX Proxy contract address. This can only be done via a Safe transaction.
    /// @param dx New proxy contract address for DutchX.
    function changeDXProxy(address dx)
        public
        authorized
    {
        require(dx != address(0), "Invalid address provided");
        dutchXAddress = dx;
    }

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
        // PostSellOrder, postBuyOrder, claimTokensFromSeveralAuctionsAsBuyer, claimTokensFromSeveralAuctionsAsSeller, deposit
        // Are allowed for the Dutch X contract
        if (functionIdentifier == tokenInterface.approve.selector) {
            uint spender;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                spender := mload(add(data, 0x24))
            }

            // TODO we need abi.decodeWithSelector
            // approve(address spender, uint256 amount) we skip the amount
            //(address spender) = abi.decode(dataParams, (address));

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
            //(address sellToken, address buyToken) = abi.decode(data, (address, address));
            
            uint sellToken;
            uint buyToken;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                sellToken := mload(add(data, 0x24))
                buyToken := mload(add(data, 0x44))
            }
            require (isWhitelistedToken[address(sellToken)] && isWhitelistedToken[address(buyToken)], "Only whitelisted tokens can be sold");
        } else if (functionIdentifier == dxInterface.postBuyOrder.selector) {
            // TODO we need abi.decodeWithSelector
            // postBuyOrder(address sellToken, address buyToken, uint256 auctionIndex, uint256 amount) we skip auctionIndex and amount
            // (address sellToken, address buyToken) = abi.decode(data, (address, address));

            uint sellToken;
            uint buyToken;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                sellToken := mload(add(data, 0x24))
                buyToken := mload(add(data, 0x44))
            }
            require (isWhitelistedToken[address(sellToken)] && isWhitelistedToken[address(buyToken)], "Only whitelisted tokens can be bought");
        } else {
            // Other functions different than claim and deposit are not allowed
            require(functionIdentifier == dxInterface.claimTokensFromSeveralAuctionsAsSeller.selector || functionIdentifier == dxInterface.claimTokensFromSeveralAuctionsAsBuyer.selector || functionIdentifier == tokenInterface.deposit.selector, "Function not allowed");
        }

        require(manager.execTransactionFromModule(to, value, data, Enum.Operation.Call), "Could not execute transaction");
    }
}
