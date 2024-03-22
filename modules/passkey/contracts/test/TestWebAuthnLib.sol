// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import {WebAuthn} from "../libraries/WebAuthn.sol";
import {IP256Verifier} from "../libraries/P256.sol";

contract TestWebAuthnLib {
    function signingMessage(
        bytes32 challenge,
        bytes calldata authenticatorData,
        string calldata clientDataFields
    ) public pure returns (bytes32 message) {
        message = WebAuthn.signingMessage(challenge, authenticatorData, clientDataFields);
    }

    function verifySignatureCastSig(
        bytes32 challenge,
        bytes calldata signature,
        WebAuthn.AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        IP256Verifier verifier
    ) public view returns (bool success) {
        success = WebAuthn.verifySignature(challenge, signature, authenticatorFlags, x, y, verifier);
    }

    function verifySignature(
        bytes32 challenge,
        WebAuthn.Signature calldata signature,
        WebAuthn.AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        IP256Verifier verifier
    ) public view returns (bool success) {
        success = WebAuthn.verifySignature(challenge, signature, authenticatorFlags, x, y, verifier);
    }
}
