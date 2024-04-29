// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

import {IStandardExecutor, Call} from "../interfaces/IStandardExecutor.sol";

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IPlugin} from "../interfaces/IPlugin.sol";
import {IAccount} from "../interfaces/IAccount.sol";
import {HandlerContext} from "@safe-global/safe-contracts/contracts/handler/HandlerContext.sol";
import {EntryPointValidator} from "../base/EntryPointValidator.sol";

abstract contract Executor is IStandardExecutor, HandlerContext, EntryPointValidator {
    error CallToPluginNotAllowed(address plugin);
    error ExecutionFailed();

    function execute(address target, uint256 value, bytes calldata data) external payable override returns (bytes memory) {
        return _execute(target, value, data);
    }

    function executeBatch(Call[] calldata calls) external payable override returns (bytes[] memory) {
        uint256 length = calls.length;
        bytes[] memory result = new bytes[](length);
        for (uint i = 0; i < length; i++) {
            result[i] = _execute(calls[i].target, calls[i].value, calls[i].data);
        }
        return result;
    }

    function _execute(address target, uint256 value, bytes calldata data) internal returns (bytes memory) {
        if (IERC165(target).supportsInterface(type(IPlugin).interfaceId)) {
            revert CallToPluginNotAllowed(target);
        }

        validateExecution();

        (bool isActionSuccessful, bytes memory resultData) = IAccount(msg.sender).execTransactionFromModuleReturnData(
            target,
            value,
            data,
            0
        );
        if (isActionSuccessful) {
            return resultData;
        } else {
            revert ExecutionFailed();
        }
    }

    function validateExecution() internal {
        if (_msgSender() == supportedEntryPoint) {
            return;
        }
    }
}
