// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {UserOperationLib} from "@account-abstraction/contracts/core/UserOperationLib.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";

contract SafeMock {
    address public singleton;
    address public owner;
    address public fallbackHandler;
    mapping(address => bool) public modules;

    constructor() {
        owner = msg.sender;
    }

    function setup(address _fallbackHandler, address _module) public virtual {
        require(owner == address(0), "Already setup");
        owner = msg.sender;
        fallbackHandler = _fallbackHandler;
        modules[_module] = true;
    }

    function _signatureSplit(bytes memory signature) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
    }

    function checkSignatures(bytes32 dataHash, bytes memory data, bytes memory signature) public view {
        require(dataHash == keccak256(data), "Invalid data hash");
        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = _signatureSplit(signature);
        require(
            // The original safe contract requires the V value to be > 30 for EIP-191 signed messages
            // The canonical eth V value is 27 or 28, so by adding 4 to it we get a value > 30
            // And when we verify the signature we subtract 4 from it
            owner == ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash)), v - 4, r, s),
            "Invalid signature"
        );
    }

    function exec(address payable to, uint256 value, bytes calldata data) external {
        bool success;
        bytes memory response;
        (success, response) = to.call{value: value}(data);
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                revert(add(response, 0x20), mload(response))
            }
        }
    }

    function execTransactionFromModule(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success) {
        require(modules[msg.sender], "not executing that");

        if (operation == 1) (success, ) = to.delegatecall(data);
        else (success, ) = to.call{value: value}(data);
    }

    function execTransactionFromModuleReturnData(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success, bytes memory returnData) {
        require(modules[msg.sender], "not executing that");

        if (operation == 1) (success, returnData) = to.delegatecall(data);
        else (success, returnData) = to.call{value: value}(data);
    }

    // solhint-disable-next-line payable-fallback,no-complex-fallback
    fallback() external payable {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            let handler := sload(fallbackHandler.slot)
            if iszero(handler) {
                return(0, 0)
            }

            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            // The msg.sender address is shifted to the left by 12 bytes to remove the padding
            // Then the address without padding is stored right after the calldata
            mstore(add(ptr, calldatasize()), shl(96, caller()))
            // Add 20 bytes for the address appended add the end
            let success := call(gas(), handler, 0, ptr, add(calldatasize(), 20), 0, 0)
            returndatacopy(ptr, 0, returndatasize())
            if iszero(success) {
                revert(ptr, returndatasize())
            }
            return(ptr, returndatasize())
        }
    }

    receive() external payable {}
}