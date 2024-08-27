// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

import {PluginManager} from "./base/PluginManager.sol";
import {Executor} from "./base/Executor.sol";
import {Safe4337} from "./base/Safe4337.sol";
import {EntryPointValidator} from "./base/EntryPointValidator.sol";


contract Safe6900Module is PluginManager, Executor, Safe4337 {
    constructor(address entryPoint) EntryPointValidator(entryPoint) Safe4337(entryPoint) {}
}
