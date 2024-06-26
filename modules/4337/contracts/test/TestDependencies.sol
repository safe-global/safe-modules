// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable no-global-import */
pragma solidity >=0.8.0;

import "@safe-global/safe-contracts/contracts/libraries/MultiSend.sol";
import "@safe-global/safe-contracts/contracts/libraries/SafeStorage.sol";
import "@safe-global/safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import "@safe-global/safe-contracts/contracts/SafeL2.sol";
// Named import for EntryPointSimulations needed because it also defines an interface for IERC165, which
// conflicts with the same interface defined in the Safe contracts.
/* solhint-disable-next-line no-unused-import */
import {EntryPointSimulations} from "@account-abstraction/contracts/core/EntryPointSimulations.sol";
