// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import "./UserOperation.sol";
import "./interfaces/Safe.sol";

// TODO Add EIP-165
interface Handler {
    function handle(address executor, bytes calldata data) external returns (bool success, bytes memory response);

    function verify(
        address executor,
        UserOperation calldata userOp,
        uint256 requiredPrefund
    ) external returns (uint256);
}

contract SafeProcotol {
    mapping(address => mapping(bytes32 => Handler)) public schemeHandlers;
    mapping(address => mapping(bytes4 => Handler)) public fallbackHandlers;

    constructor() {}

    function registerScheme(string calldata scheme, Handler handler) external {
        bytes32 schemeId = keccak256(bytes(scheme));
        // TODO Add EIP-165 check
        schemeHandlers[msg.sender][schemeId] = handler;
    }

    function registerFallback(bytes4 functionId, Handler handler) external {
        // TODO Add EIP-165 check
        fallbackHandlers[msg.sender][functionId] = handler;
    }

    // Start: EIP-4337 specific
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 requiredPrefund
    ) external returns (uint256) {
        require(userOp.sender == msg.sender, "Invalid sender");
        require(this.handleScheme.selector == bytes4(userOp.callData), "Unexpected method");
        (bytes32 schemeId, ) = abi.decode(userOp.callData[4:], (bytes32, bytes));
        Handler handler = schemeHandlers[msg.sender][schemeId];
        return handler.verify(msg.sender, userOp, requiredPrefund);
    }

    function handleScheme(bytes32 schemeId, bytes memory data) external returns (bool success, bytes memory response) {
        Handler handler = schemeHandlers[msg.sender][schemeId];
        return handler.handle(msg.sender, data);
    }

    // End: EIP-4337 specific

    function processSchemeRequest(
        bytes32 schemeId,
        address executor,
        address target,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external {
        Handler handler = schemeHandlers[executor][schemeId];
        require(address(handler) == msg.sender, "Handler not registered");
        Safe(target).execTransactionFromModule(target, value, data, operation);
    }

    fallback() external {
        Handler handler = fallbackHandlers[msg.sender][bytes4(msg.data)];
        // TODO forward return data propery
        (bool success, bytes memory response) = handler.handle(msg.sender, msg.data);
        if (!success) revert(string(response));
    }
}
