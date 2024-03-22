// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import {WebAuthn} from "../libraries/WebAuthn.sol";
import {IP256Verifier} from "../libraries/P256.sol";

contract TestWebAuthnLib {
    /**
     * @notice Generate a signing message based on the authenticator data, challenge, and client
     * data fields.
     * @dev The signing message are the 32-bytes that are actually signed by the P-256 private key
     * when doing a WebAuthn credential assertion. Note that we verify that the challenge is indeed
     * signed by using its value to compute the signing message on-chain.
     * @param challenge The WebAuthn challenge used for the credential assertion.
     * @param authenticatorData Authenticator data.
     * @param clientDataFields Client data fields.
     * @return message Signing message.
     */
    function signingMessage(
        bytes32 challenge,
        bytes calldata authenticatorData,
        string calldata clientDataFields
    ) public pure returns (bytes32 message) {
        message = WebAuthn.signingMessage(challenge, authenticatorData, clientDataFields);
    }

    /**
     * @notice Verifies a WebAuthn signature.
     * @param challenge The WebAuthn challenge used in the credential assertion.
     * @param signature The encoded WebAuthn signature bytes.
     * @param authenticatorFlags The authenticator data flags that must be set.
     * @param x The x-coordinate of the credential's public key.
     * @param y The y-coordinate of the credential's public key.
     * @param verifier The P-256 verifier implementation to use.
     * @return success Whether the signature is valid.
     */
    function verifySignatureCastSig(
        bytes32 challenge,
        bytes calldata signature,
        WebAuthn.AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        IP256Verifier verifier
    ) public view returns (bool success) {
        success = verifySignature(challenge, WebAuthn.castSignature(signature), authenticatorFlags, x, y, verifier);
    }

    /**
     * @notice Verifies a WebAuthn signature.
     * @param challenge The WebAuthn challenge used in the credential assertion.
     * @param signature The WebAuthn signature data.
     * @param authenticatorFlags The authenticator data flags that must be set.
     * @param x The x-coordinate of the credential's public key.
     * @param y The y-coordinate of the credential's public key.
     * @param verifier The P-256 verifier implementation to use.
     * @return success Whether the signature is valid.
     */
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
