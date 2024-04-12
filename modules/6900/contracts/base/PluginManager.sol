// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

import {IPluginManager, FunctionReference} from "../interfaces/IPluginManager.sol";
import {IPlugin} from "../interfaces/IPlugin.sol";
import {OnlyAccountCallable} from "../base/OnlyAccountCallable.sol";

contract PluginManager is IPluginManager, OnlyAccountCallable {
    /// @dev A mapping containing the installed plugins for an account. Safe address => Plugin address => uint256 (0 = not installed, 1 = installed)
    mapping(address => mapping(address => uint256)) public installedPlugins;

    error PluginAlreadyInstalled(address plugin);

    /// @inheritdoc IPluginManager
    function installPlugin(
        address plugin,
        bytes32 manifestHash,
        bytes calldata pluginInstallData,
        FunctionReference[] calldata dependencies
    ) external override onlyAccount {
        // Check if already installed
        if (installedPlugins[msg.sender][plugin] == 1) {
            revert PluginAlreadyInstalled(plugin);
        }

        // TODO: Revert if ERC-165 not supported by plugin or does not support IPlugin interface
        // TODO: Validate manifestHash
        // TODO: Update account storage
        // TODO: Check for dependencies

        // TODO: Evaluate if state changes are required before calling onInstall
        installedPlugins[msg.sender][plugin] = 1;

        IPlugin(plugin).onInstall(pluginInstallData);

        emit PluginInstalled(plugin, manifestHash, dependencies);
        revert("Safe6900Module: not implemented");
    }

    function uninstallPlugin(address plugin, bytes calldata config, bytes calldata pluginUninstallData) external override onlyAccount {
        // TODO: Validate manifestHash
        // TODO: Check for dependencies
        // TODO: Update account storage
        // TODO: Other checks

        // TODO: Evaluate if state changes are required before calling onUninstall
        installedPlugins[msg.sender][plugin] = 0;

        IPlugin(plugin).onUninstall(pluginUninstallData);

        emit PluginUninstalled(plugin, true);
        revert("Safe6900Module: not implemented");
    }
}
