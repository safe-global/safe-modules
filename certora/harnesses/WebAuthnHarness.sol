// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import {P256, WebAuthn} from "../../modules/passkey/contracts/libraries/WebAuthn.sol";

contract WebAuthnHarness {
    
    function castSignature(bytes calldata signature) internal pure returns (bool isValid, WebAuthn.Signature calldata data){
        return WebAuthn.castSignature(signature);
    }

    function encodeClientDataJson(
        bytes32 challenge,
        string calldata clientDataFields
    ) public pure returns (string memory clientDataJson){
        return WebAuthn.encodeClientDataJson(challenge, clientDataFields);
    }

    function encodeSigningMessage(
        bytes32 challenge,
        bytes calldata authenticatorData,
        string calldata clientDataFields
    ) public view returns (bytes memory message) {
        return WebAuthn.encodeSigningMessage(challenge, authenticatorData, clientDataFields);
    }

    function checkAuthenticatorFlags(
        bytes calldata authenticatorData,
        WebAuthn.AuthenticatorFlags authenticatorFlags
    ) public pure returns (bool success){
        return WebAuthn.checkAuthenticatorFlags(authenticatorData, authenticatorFlags);
    }

    function verifySignature(
        bytes32 challenge,
        bytes calldata signature,
        WebAuthn.AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        P256.Verifiers verifiers
    ) public view returns (bool success) {
        return WebAuthn.verifySignature(challenge, signature, authenticatorFlags, x, y, verifiers);
    }

    function verifySignature(
        bytes32 challenge,
        WebAuthn.Signature calldata signature,
        WebAuthn.AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        P256.Verifiers verifiers
    ) public view returns (bool success) {
        return WebAuthn.verifySignature(challenge, signature, authenticatorFlags, x, y, verifiers);
    }
    
}
