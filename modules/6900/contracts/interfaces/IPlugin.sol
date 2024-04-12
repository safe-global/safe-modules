// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;
import {PluginManifest, PluginMetadata} from "./DataTypes.sol";

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

interface IPlugin {
    function onInstall(bytes calldata data) external;
    function onUninstall(bytes calldata data) external;

    function preUserOpValidationHook(uint8 functionId, UserOperation memory userOp, bytes32 userOpHash) external returns (uint256);

    function userOpValidationFunction(uint8 functionId, UserOperation calldata userOp, bytes32 userOpHash) external returns (uint256);

    function preRuntimeValidationHook(uint8 functionId, address sender, uint256 value, bytes calldata data) external;

    function runtimeValidationFunction(uint8 functionId, address sender, uint256 value, bytes calldata data) external;

    function preExecutionHook(uint8 functionId, address sender, uint256 value, bytes calldata data) external returns (bytes memory);

    function postExecutionHook(uint8 functionId, bytes calldata preExecHookData) external;

    function pluginManifest() external pure returns (PluginManifest memory);

    function pluginMetadata() external pure returns (PluginMetadata memory);
}
