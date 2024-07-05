// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable no-complex-fallback */
/* solhint-disable payable-fallback */
pragma solidity ^0.8.20;

import {IP256Verifier} from "../interfaces/IP256Verifier.sol";

contract DummyP256Verifier is IP256Verifier {
    fallback(bytes calldata) external returns (bytes memory output) {
        output = abi.encode(true);
    }
}
