// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

import {IPluginManager, FunctionReference} from "../interfaces/IPluginManager.sol";
import {IPlugin} from "../interfaces/IPlugin.sol";
import {OnlyAccountCallable} from "../base/OnlyAccountCallable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {PluginManifest} from "../interfaces/DataTypes.sol";

abstract contract PluginManager is IPluginManager, OnlyAccountCallable {
    /// @dev A mapping containing the installed plugins for an account. Safe address => Plugin address => uint256 (0 = not installed, 1 = installed)
    mapping(address => mapping(address => uint256)) public installedPlugins;

    error PluginAlreadyInstalled(address plugin);
    error PluginInterfaceNotSupported(address plugin);
    error PluginManifestHashMismatch(bytes32 manifestHash);
    error PluginDepenencyCountMismatch();

    /// @inheritdoc IPluginManager
    function installPlugin(
        address plugin,
        bytes32 manifestHash,
        bytes calldata pluginInstallData,
        FunctionReference[] calldata dependencies
    ) external override onlyAccount {
        // 1. Check if already installed
        if (installedPlugins[msg.sender][plugin] == 1) {
            revert PluginAlreadyInstalled(plugin);
        }

        // 2. Revert if ERC-165 not supported by plugin or does not support IPlugin interface
        // TODO: Evaluate if try-catch needed
        if (!IERC165(plugin).supportsInterface(type(IPlugin).interfaceId)) {
            revert PluginInterfaceNotSupported(plugin);
        }

        // // 3. Validate manifestHash
        // PluginManifest memory manifest = IPlugin(plugin).pluginManifest();
        // if (!(manifestHash == keccak256(abi.encode(manifest)))) {
        //     revert PluginManifestHashMismatch(manifestHash);
        // }

        // // 4. TODO: Check for dependencies

        // // 4.1 Length checks
        // if (dependencies.length != manifest.dependencyInterfaceIds.length) {
        //     revert PluginDepenencyCountMismatch();
        // }

        // 4.2 Dependency does not support interface
        // uint256 length = dependencies.length;
        // for (uint256 i = 0; i < length; i++) {
        //     (address dependencyAddress,) = dependencies[i].unpack();

        //     if (!IERC165().supportsInterface(manifest.dependencyInterfaceIds[i])) {
        //         revert PluginInterfaceNotSupported(dependencies[i].target);
        //     }
        // }

        // 5. Evaluate if state changes are required before calling onInstall
        installedPlugins[msg.sender][plugin] = 1;

        // 6: Evaluate if try-catch needed
        IPlugin(plugin).onInstall(pluginInstallData);

        // 7. Emit event
        emit PluginInstalled(plugin, manifestHash, dependencies);        
    }

    function uninstallPlugin(address plugin, bytes calldata config, bytes calldata pluginUninstallData) external override onlyAccount {
        // TODO: Validate manifestHash
        // TODO: Check for dependencies
        // TODO: Other checks

        // TODO: Evaluate if state changes are required before calling onUninstall
        installedPlugins[msg.sender][plugin] = 0;

        // TODO: Evaluate if try-catch needed
        IPlugin(plugin).onUninstall(pluginUninstallData);

        emit PluginUninstalled(plugin, true);
    }
}
