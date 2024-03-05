// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable payable-fallback */
pragma solidity ^0.8.0;

import {IP256Verifier, P256VerifierLib} from "../verifiers/IP256Verifier.sol";

contract TestP256VerifierLib {
    using P256VerifierLib for IP256Verifier;

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
