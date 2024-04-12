// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

interface IPluginExecutor {
    function executeFromPlugin(bytes calldata data) external payable returns (bytes memory);
    function executeFromPluginExternal(address target, uint256 value, bytes calldata data) external payable returns (bytes memory);
}
