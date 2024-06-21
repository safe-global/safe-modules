// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import {IP256Verifier, P256} from "../libraries/P256.sol";

contract TestP256Lib {
    using P256 for IP256Verifier;
    using P256 for P256.Verifiers;

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

    function verifySignatureWithVerifiers(
        P256.Verifiers verifiers,
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) external view returns (bool success) {
        success = verifiers.verifySignature(message, r, s, x, y);
    }

    function verifySignatureWithVerifiersAllowMalleability(
        P256.Verifiers verifiers,
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) external view returns (bool success) {
        success = verifiers.verifySignatureAllowMalleability(message, r, s, x, y);
    }
}
