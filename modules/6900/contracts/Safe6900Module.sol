// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

import {PluginManager} from "./base/PluginManager.sol";
import {Executor} from "./base/Executor.sol";

contract Safe6900Module is PluginManager, Executor {}