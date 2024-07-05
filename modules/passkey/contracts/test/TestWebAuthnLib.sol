// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import {P256, WebAuthn} from "../libraries/WebAuthn.sol";

contract TestWebAuthnLib {
    function castSignature(bytes calldata signature) external pure returns (WebAuthn.Signature calldata data) {
        bool success;
        (success, data) = WebAuthn.castSignature(signature);
        require(success, "invalid signature encoding");
    }

    function encodeClientDataJson(
        bytes32 challenge,
        string calldata clientDataFields
    ) external pure returns (string memory clientDataJson) {
        clientDataJson = WebAuthn.encodeClientDataJson(challenge, clientDataFields);
    }

    function encodeSigningMessage(
        bytes32 challenge,
        bytes calldata authenticatorData,
        string calldata clientDataFields
    ) external view returns (bytes memory message) {
        message = WebAuthn.encodeSigningMessage(challenge, authenticatorData, clientDataFields);
    }

    function verifySignatureCastSig(
        bytes32 challenge,
        bytes calldata signature,
        WebAuthn.AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        P256.Verifiers verifiers
    ) external view returns (bool success) {
        success = WebAuthn.verifySignature(challenge, signature, authenticatorFlags, x, y, verifiers);
    }

    function verifySignature(
        bytes32 challenge,
        WebAuthn.Signature calldata signature,
        WebAuthn.AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        P256.Verifiers verifiers
    ) external view returns (bool success) {
        success = WebAuthn.verifySignature(challenge, signature, authenticatorFlags, x, y, verifiers);
    }
}
