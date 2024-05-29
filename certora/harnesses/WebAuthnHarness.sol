// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import {P256, WebAuthn} from "../../modules/passkey/contracts/libraries/WebAuthn.sol";

contract WebAuthnHarness {
    function compareSignatures(WebAuthn.Signature memory sig1, WebAuthn.Signature memory sig2) public pure returns (bool) {
        if (sig1.r != sig2.r || sig1.s != sig2.s) {
            return false;
        }

        if (keccak256(abi.encodePacked(sig1.clientDataFields)) != keccak256(abi.encodePacked(sig2.clientDataFields))) {
            return false;
        }

        if (keccak256(sig1.authenticatorData) != keccak256(sig2.authenticatorData)) {
            return false;
        }

        return true;
    }

    function encodeSignature(WebAuthn.Signature calldata sig) external pure returns (bytes memory signature){
        signature = abi.encode(sig);
    }

    function castSignature(bytes calldata signature) external pure returns (bool isValid, WebAuthn.Signature calldata data){
        return WebAuthn.castSignature(signature);
    }

    function compareStrings(string memory str1, string memory str2) public view returns (bool) {
        bytes memory str1Bytes = bytes(str1);
        bytes memory str2Bytes = bytes(str2);
        return getSha256(str1Bytes) == getSha256(str2Bytes);
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

    function prepareSignature(bytes calldata authenticatorData,
        string calldata clientDataFields,
        uint256 r,
        uint256 s) public pure returns(bytes memory signature, WebAuthn.Signature memory structSignature){
        signature = abi.encode(authenticatorData, clientDataFields, r, s);
        structSignature = WebAuthn.Signature(authenticatorData, clientDataFields, r, s);
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

    function getSha256(bytes memory input) public view returns (bytes32 digest) {
        return WebAuthn._sha256(input);
    }
    
}
