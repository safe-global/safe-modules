pragma solidity ^0.5.0;
import "@gnosis.pm/safe-contracts/contracts/base/Module.sol";


/// @title DutchX Base Module - Expose a set of methods to enable a Safe to interact with a DX
/// @author Denis Granha - <denis@gnosis.pm>
contract DutchXBaseModule is Module {

    address public dutchXAddress;
    // isWhitelistedToken mapping maps destination address to boolean.
    mapping (address => bool) public isWhitelistedToken;
    mapping (address => bool) public isOperator;

    // helper variables used by the CLI
    address[] public whitelistedTokens; 
    address[] public whitelistedOperators;

    /// @dev Setup function sets initial storage of contract.
    /// @param dx DutchX Proxy Address.
    /// @param tokens List of whitelisted tokens.
    /// @param operators List of addresses that can operate the module.
    /// @param _manager Address of the manager, the safe contract.
    function setup(address dx, address[] memory tokens, address[] memory operators, address payable _manager)
        public
    {
        require(address(manager) == address(0), "Manager has already been set");
        if (_manager == address(0)){
            manager = ModuleManager(msg.sender);
        }
        else{
            manager = ModuleManager(_manager);
        }

        dutchXAddress = dx;

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            require(token != address(0), "Invalid token provided");
            isWhitelistedToken[token] = true;
        }

        whitelistedTokens = tokens;

        for (uint256 i = 0; i < operators.length; i++) {
            address operator = operators[i];
            require(operator != address(0), "Invalid operator address provided");
            isOperator[operator] = true;
        }

        whitelistedOperators = operators;
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
        whitelistedTokens.push(token);
    }

    /// @dev Allows to remove token from whitelist. This can only be done via a Safe transaction.
    /// @param token ERC20 token address.
    function removeFromWhitelist(address token)
        public
        authorized
    {
        require(isWhitelistedToken[token], "Token is not whitelisted");
        isWhitelistedToken[token] = false;

        for (uint i = 0; i<whitelistedTokens.length - 1; i++)
            if(whitelistedTokens[i] == token){
                whitelistedTokens[i] = whitelistedTokens[whitelistedTokens.length-1];
                break;
            }
        whitelistedTokens.length -= 1;
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
        whitelistedOperators.push(operator);
    }

    /// @dev Allows to remove operator from whitelist. This can only be done via a Safe transaction.
    /// @param operator ethereum address.
    function removeOperator(address operator)
        public
        authorized
    {
        require(isOperator[operator], "Operator is not whitelisted");
        isOperator[operator] = false;

        for (uint i = 0; i<whitelistedOperators.length - 1; i++)
            if(whitelistedOperators[i] == operator){
                whitelistedOperators[i] = whitelistedOperators[whitelistedOperators.length-1];
                break;
            }
        whitelistedOperators.length -= 1;

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

    /// @dev Abstract method. Returns if Safe transaction is to DutchX contract and with whitelisted tokens.
    /// @param to Dutch X address or Whitelisted token (only for approve operations for DX).
    /// @param value Not checked.
    /// @param data Allowed operations
    /// @return Returns if transaction can be executed.
    function executeWhitelisted(address to, uint256 value, bytes memory data)
        public
        returns (bool);


    /// @dev Returns list of whitelisted tokens.
    /// @return List of whitelisted tokens addresses.
    function getWhitelistedTokens()
        public
        view
        returns (address[] memory)
    {
        return whitelistedTokens;
    }

    /// @dev Returns list of whitelisted operators.
    /// @return List of whitelisted operators addresses.
    function getWhitelistedOperators()
        public
        view
        returns (address[] memory)
    {
        return whitelistedOperators;
    }
}
