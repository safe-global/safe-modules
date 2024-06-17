// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

import {IPluginManager, FunctionReference} from "../interfaces/IPluginManager.sol";
import {IPlugin} from "../interfaces/IPlugin.sol";
import {OnlyAccountCallable} from "../base/OnlyAccountCallable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {PluginManifest} from "../interfaces/DataTypes.sol";

abstract contract PluginManager is IPluginManager, OnlyAccountCallable {
    struct PluginData {
        address plugin;
        bytes32 manifestHash;
        FunctionReference[] dependencies;
        // uint256 to indicate if the plugin can spend native tokens. 0 = false, 1 = true
        uint256 canSpendNativeToken;
        // 0 = false, 1 = true
        uint256 permittedExternalCalls;
    }

    struct SelectorData {
        address plugin;
    }

    struct ERC6900AccountData {
        mapping(address => PluginData) installedPlugins;
        mapping(bytes4 => SelectorData) selectorData;
    }

    /// @dev A mapping containing the installed plugins for an account. Safe address => Plugin address => uint256 (0 = not installed, 1 = installed)
    mapping(address => ERC6900AccountData) private accountData;

    /// @dev A mapping containing the plugin dependency count for each pluginAddress. Plugin address => uint256 (dependency count).
    mapping(address => uint256) public dependentCount;

    /// @dev A mapping containing the plugin dependency count for each account. Safe address => Plugin address => uint256 (dependency count).

    error PluginAlreadyInstalled(address plugin);
    error PluginInterfaceNotSupported(address plugin);
    error PluginManifestHashMismatch(bytes32 manifestHash);
    error PluginDepenencyCountMismatch();
    error PluginDependencyNotInstalled(address plugin, address dependency);
    error PluginDependencyInterfaceNotSupported(address plugin, bytes4 interfaceId);

    /// @inheritdoc IPluginManager
    function installPlugin(
        address plugin,
        bytes32 manifestHash,
        bytes calldata pluginInstallData,
        FunctionReference[] calldata dependencies
    ) external override onlyAccount {
        // Check if already installed
        if (accountData[msg.sender].installedPlugins[plugin].plugin != (address(0))) {
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

        // A variable used to store length of array of any of the fields in manifest.
        // This variable is reused to avoid stack too deep error.
        uint256 length;

        // Dependency does not support interface
        length = dependencies.length;
        for (uint256 i = 0; i < length; i++) {
            address dependencyAddress = address(bytes20(bytes21(FunctionReference.unwrap(dependencies[i]))));

            // Revert if dependency not installed
            if (accountData[msg.sender].installedPlugins[dependencyAddress].plugin == address(0)) {
                revert PluginDependencyNotInstalled(plugin, dependencyAddress);
            }

            if (!IERC165(dependencyAddress).supportsInterface(manifest.dependencyInterfaceIds[i])) {
                revert PluginDependencyInterfaceNotSupported(dependencyAddress, manifest.dependencyInterfaceIds[i]);
            }

            dependentCount[dependencyAddress]++;
        }

        accountData[msg.sender].installedPlugins[plugin].manifestHash = manifestHash;

        // TODO: Evaluate if state changes are required before calling onInstall
        accountData[msg.sender].installedPlugins[plugin].plugin = plugin;
        accountData[msg.sender].installedPlugins[plugin].dependencies = dependencies;
        accountData[msg.sender].installedPlugins[plugin].canSpendNativeToken = manifest.canSpendNativeToken ? 1 : 0;

        length = manifest.executionFunctions.length;

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
        delete accountData[msg.sender].installedPlugins[plugin];

        // TODO: Evaluate if try-catch needed
        IPlugin(plugin).onUninstall(pluginUninstallData);

        emit PluginUninstalled(plugin, true);
    }

    function isPluginInstalled(address account, address plugin) external view returns (uint256) {
        return accountData[account].installedPlugins[plugin].plugin != address(0) ? 1 : 0;
    }
}
