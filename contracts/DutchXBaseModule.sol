pragma solidity 0.5.0;
import "gnosis-safe/contracts/base/Module.sol";


/// @title DutchX Base Module - Expose a set of methods to enable a Safe to interact with a DX
/// @author Denis Granha - <denis@gnosis.pm>
contract DutchXBaseModule is Module {

  address public dutchXAddress;
  // isWhitelistedToken mapping maps destination address to boolean.
  mapping (address => bool) public isWhitelistedToken;
  mapping (address => bool) public isOperator;

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

  /// @dev Abstract method. Returns if Safe transaction is to DutchX contract and with whitelisted tokens.
  /// @param to Dutch X address or Whitelisted token (only for approve operations for DX).
  /// @param value Not checked.
  /// @param data Allowed operations
  /// @return Returns if transaction can be executed.
  function executeWhitelisted(address to, uint256 value, bytes memory data)
      public
      returns (bool);

}
