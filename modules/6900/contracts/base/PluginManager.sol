// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

import {IPluginManager, FunctionReference} from "../interfaces/IPluginManager.sol";
import {IPlugin} from "../interfaces/IPlugin.sol";
import {OnlyAccountCallable} from "../base/OnlyAccountCallable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {PluginManifest} from "../interfaces/DataTypes.sol";
import {IAccount} from "../interfaces/IAccount.sol";
import {HandlerContext} from "@safe-global/safe-contracts/contracts/handler/HandlerContext.sol";
import {Safe6900DelegateCallReceiver} from "../Safe6900DelegateCallReceiver.sol";

abstract contract PluginManager is IPluginManager, OnlyAccountCallable, HandlerContext, Safe6900DelegateCallReceiver {
    /// @inheritdoc IPluginManager
    function installPlugin(
        address plugin,
        bytes32 manifestHash,
        bytes calldata pluginInstallData,
        FunctionReference[] calldata dependencies
    ) public override onlyAccount {
        address safe = _msgSender();

        (bool success, bytes memory data) = IAccount(safe).execTransactionFromModuleReturnData(
            payable(address(this)),
            0,
            abi.encodeWithSelector(
                Safe6900DelegateCallReceiver.installPluginDelegateCallReceiver.selector,
                plugin,
                manifestHash,
                pluginInstallData,
                dependencies
            ),
            1 // delegatecall
        );

        if (!success) {
            if (data.length == 0) revert();
            assembly {
                // We use Yul's revert() to bubble up errors from the target contract.
                revert(add(32, data), mload(data))
            }
        }
    }

    function uninstallPlugin(address plugin, bytes calldata config, bytes calldata pluginUninstallData) external override onlyAccount {
        address safe = _msgSender();
        (bool success, bytes memory data) = IAccount(safe).execTransactionFromModuleReturnData(
            payable(address(this)),
            0,
            abi.encodeWithSelector(
                Safe6900DelegateCallReceiver.uninstallPluginDelegateCallReceiver.selector,
                plugin,
                config,
                pluginUninstallData
            ),
            1 // delegatecall
        );

        if (!success) {
            if (data.length == 0) revert();
            assembly {
                // We use Yul's revert() to bubble up errors from the target contract.
                revert(add(32, data), mload(data))
            }
        }
    }

    function isPluginInstalled(address safe, address plugin) external returns (bool) {
        (bool success, bytes memory data) = IAccount(safe).execTransactionFromModuleReturnData(
            payable(address(this)),
            0,
            abi.encodeWithSelector(Safe6900DelegateCallReceiver.isPluginInstalledDelegateCallReceiver.selector, plugin),
            1 // delegatecall
        );

        if (!success) {
            return false;
        }
        return abi.decode(data, (bool));
    }
}
