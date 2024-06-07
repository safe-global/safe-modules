// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

import {IPluginManager, FunctionReference} from "../interfaces/IPluginManager.sol";
import {IPlugin} from "../interfaces/IPlugin.sol";
import {OnlyAccountCallable} from "../base/OnlyAccountCallable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {PluginManifest} from "../interfaces/DataTypes.sol";

abstract contract PluginManager is IPluginManager, OnlyAccountCallable {

    struct ERC6900AccountData {
        mapping(address => uint256) installedPlugins;
    }

    /// @dev A mapping containing the installed plugins for an account. Safe address => Plugin address => uint256 (0 = not installed, 1 = installed)
    mapping(address => ERC6900AccountData) private accountData;

    /// @dev A mapping containing the plugin dependency count for each account. Safe address => Plugin address => uint256 (dependency count).

    error PluginAlreadyInstalled(address plugin);
    error PluginInterfaceNotSupported(address plugin);
    error PluginManifestHashMismatch(bytes32 manifestHash);
    error PluginDepenencyCountMismatch();
    error PluginDependencyNotInstalled(address plugin, address dependency);

    /// @inheritdoc IPluginManager
    function installPlugin(
        address plugin,
        bytes32 manifestHash,
        bytes calldata pluginInstallData,
        FunctionReference[] calldata dependencies
    ) external override onlyAccount {
        // Check if already installed
        if (accountData[msg.sender].installedPlugins[plugin] == 1) {
            revert PluginAlreadyInstalled(plugin);
        }

        // Revert if ERC-165 not supported by plugin or does not support IPlugin interface
        // TODO: Evaluate if try-catch needed
        if (!IERC165(plugin).supportsInterface(type(IPlugin).interfaceId)) {
            revert PluginInterfaceNotSupported(plugin);
        }

        // Validate manifestHash
        PluginManifest memory manifest = IPlugin(plugin).pluginManifest();

        if (!(manifestHash == keccak256(abi.encode(manifest)))) {
            revert PluginManifestHashMismatch(manifestHash);
        }

        // Length checks
        if (dependencies.length != manifest.dependencyInterfaceIds.length) {
            revert PluginDepenencyCountMismatch();
        }

        // Dependency does not support interface
        uint256 length = dependencies.length;
        for (uint256 i = 0; i < length; i++) {
            address dependencyAddress = address(bytes20(bytes21(FunctionReference.unwrap(dependencies[i]))));

            if (!IERC165(dependencyAddress).supportsInterface(manifest.dependencyInterfaceIds[i])) {
                revert PluginInterfaceNotSupported(dependencyAddress);
            }

            // Revert if dependency not installed
            if (accountData[msg.sender].installedPlugins[dependencyAddress] != 1) {
                revert PluginDependencyNotInstalled(plugin, dependencyAddress);
            }
        }

        // TODO: Update dependency count

        // TODO: Evaluate if state changes are required before calling onInstall
        accountData[msg.sender].installedPlugins[plugin] = 1;

        // TODO: Evaluate if try-catch needed
        IPlugin(plugin).onInstall(pluginInstallData);

        // Emit event
        emit PluginInstalled(plugin, manifestHash, dependencies);
    }

    function uninstallPlugin(address plugin, bytes calldata config, bytes calldata pluginUninstallData) external override onlyAccount {
        // TODO: Validate manifestHash
        // TODO: Check for dependencies
        // TODO: Other checks

        // TODO: Evaluate if state changes are required before calling onUninstall
        accountData[msg.sender].installedPlugins[plugin] = 0;

        // TODO: Evaluate if try-catch needed
        IPlugin(plugin).onUninstall(pluginUninstallData);

        emit PluginUninstalled(plugin, true);
    }

    function isPluginInstalled(address account, address plugin) external view returns (uint256) {
        return accountData[account].installedPlugins[plugin];
    }
}
