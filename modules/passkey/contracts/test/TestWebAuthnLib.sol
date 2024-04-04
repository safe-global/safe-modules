// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import {WebAuthn} from "../libraries/WebAuthn.sol";
import {IP256Verifier} from "../libraries/P256.sol";

contract TestWebAuthnLib {
    function encodeClientDataJson(
        bytes32 challenge,
        string calldata clientDataFields
    ) external pure returns (string memory clientDataJson) {
        clientDataJson = WebAuthn.encodeClientDataJson(challenge, clientDataFields);
    }

    function signingMessage(
        bytes32 challenge,
        bytes calldata authenticatorData,
        string calldata clientDataFields
    ) external pure returns (bytes32 message) {
        message = WebAuthn.signingMessage(challenge, authenticatorData, clientDataFields);
    }

    function verifySignatureCastSig(
        bytes32 challenge,
        bytes calldata signature,
        WebAuthn.AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        IP256Verifier verifier
    ) external view returns (bool success) {
        success = WebAuthn.verifySignature(challenge, signature, authenticatorFlags, x, y, verifier);
    }

    function verifySignature(
        bytes32 challenge,
        WebAuthn.Signature calldata signature,
        WebAuthn.AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        IP256Verifier verifier
    ) external view returns (bool success) {
        success = WebAuthn.verifySignature(challenge, signature, authenticatorFlags, x, y, verifier);
    }
}
