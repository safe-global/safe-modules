// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

type FunctionReference is bytes21;

interface IPluginManager {
    event PluginInstalled(address indexed plugin, bytes32 manifestHash, FunctionReference[] dependencies);

    event PluginUninstalled(address indexed plugin, bool indexed onUninstallSucceeded);
    function installPlugin(
        address plugin,
        bytes32 manifestHash,
        bytes calldata pluginInstallData,
        FunctionReference[] calldata dependencies
    ) external;

    function uninstallPlugin(address plugin, bytes calldata config, bytes calldata pluginUninstallData) external;
}
