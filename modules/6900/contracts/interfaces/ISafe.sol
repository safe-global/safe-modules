// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

/**
 * @title ISafe Declares the functions that are called on an Safe account.
 */
interface ISafe {
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success);

    function execTransactionFromModuleReturnData(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success, bytes memory returnData);

    function checkSignatures(bytes32 dataHash, bytes memory data, bytes memory signatures) external view;
}
