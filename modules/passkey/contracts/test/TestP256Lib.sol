// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import {IP256Verifier} from "../interfaces/IP256Verifier.sol";
import {P256} from "../libraries/P256.sol";

contract TestP256Lib {
    using P256 for IP256Verifier;

    function verifySignature(
        IP256Verifier verifier,
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) external view returns (bool success) {
        success = verifier.verifySignature(message, r, s, x, y);
    }

    function verifySignatureAllowMalleability(
        IP256Verifier verifier,
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) external view returns (bool success) {
        success = verifier.verifySignatureAllowMalleability(message, r, s, x, y);
    }
}
