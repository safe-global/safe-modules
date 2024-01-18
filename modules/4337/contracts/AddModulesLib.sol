// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {ISafe} from "./vendor/Safe/interfaces/ISafe.sol";

/// @title AddModulesLib
contract AddModulesLib {
    function enableModules(address[] calldata modules) external {
        for (uint256 i = modules.length; i > 0; i--) {
            // This call will only work properly if used via a delegatecall
            ISafe(address(this)).enableModule(modules[i - 1]);
        }
    }
}
