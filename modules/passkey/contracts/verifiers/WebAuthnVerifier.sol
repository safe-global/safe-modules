// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {IP256Verifier} from "../interfaces/IP256Verifier.sol";
import {IWebAuthnVerifier} from "../interfaces/IWebAuthnVerifier.sol";
import {P256} from "../libraries/P256.sol";
import {Base64Url} from "../vendor/FCL/utils/Base64Url.sol";

/**
 * @title WebAuthnVerifier
 * @dev A contract that implements a WebAuthn signature verification following the precompile's interface.
 * The contract inherits from `P256VerifierWithWrapperFunctions` and provides wrapper functions for WebAuthn signatures.
 *
 * This contract is designed to allow verifying signatures from WebAuthn-compatible devices, such as biometric authenticators.
 * It works by generating a signing message based on the authenticator data, challenge, and client data fields, and then verifying the signature using the P256 elliptic curve.
 *
 * The contract provides two main functions:
 * - `verifyWebAuthnSignatureAllowMalleability`: Verifies the signature of a WebAuthn message using P256 elliptic curve, allowing for signature malleability.
 * - `verifyWebAuthnSignature`: Verifies the signature of a WebAuthn message using the P256 elliptic curve, checking for signature malleability.
 *
 * Both functions take the authenticator data, authenticator flags, challenge, client data fields, r and s components of the signature, and x and y coordinates of the public key as input.
 * The `verifyWebAuthnSignature` function also checks for signature malleability by ensuring that the s component is less than the curve order n/2.
 * @custom:security-contact bounty@safe.global
 */
contract WebAuthnVerifier is IWebAuthnVerifier {
    using P256 for IP256Verifier;

    IP256Verifier internal immutable P256_VERIFIER;

    constructor(IP256Verifier verifier) {
        P256_VERIFIER = verifier;
    }

    /**
     * @dev Generates a signing message based on the authenticator data, challenge, and client data fields.
     * @param authenticatorData Authenticator data.
     * @param challenge Challenge.
     * @param clientDataFields Client data fields.
     * @return message Signing message.
     */
    function signingMessage(
        bytes calldata authenticatorData,
        bytes32 challenge,
        bytes calldata clientDataFields
    ) internal pure returns (bytes32 message) {
        string memory encodedChallenge = Base64Url.encode(abi.encodePacked(challenge));
        /* solhint-disable quotes */
        bytes memory clientDataJson = abi.encodePacked(
            '{"type":"webauthn.get","challenge":"',
            encodedChallenge,
            '",',
            clientDataFields,
            "}"
        );
        /* solhint-enable quotes */
        message = sha256(abi.encodePacked(authenticatorData, sha256(clientDataJson)));
    }

    /**
     * @inheritdoc IWebAuthnVerifier
     */
    function verifyWebAuthnSignatureAllowMalleability(
        bytes calldata authenticatorData,
        bytes1 authenticatorFlags,
        bytes32 challenge,
        bytes calldata clientDataFields,
        uint256 r,
        uint256 s,
        uint256 qx,
        uint256 qy
    ) public view returns (bool success) {
        // check authenticator flags, e.g. for User Presence (0x01) and/or User Verification (0x04)
        if ((authenticatorData[32] & authenticatorFlags) != authenticatorFlags) {
            return false;
        }

        bytes32 message = signingMessage(authenticatorData, challenge, clientDataFields);

        success = P256_VERIFIER.verifySignatureAllowMalleability(message, r, s, qx, qy);
    }

    /**
     * @inheritdoc IWebAuthnVerifier
     */
    function verifyWebAuthnSignature(
        bytes calldata authenticatorData,
        bytes1 authenticatorFlags,
        bytes32 challenge,
        bytes calldata clientDataFields,
        uint256 r,
        uint256 s,
        uint256 qx,
        uint256 qy
    ) public view returns (bool success) {
        // check authenticator flags, e.g. for User Presence (0x01) and/or User Verification (0x04)
        if ((authenticatorData[32] & authenticatorFlags) != authenticatorFlags) {
            return false;
        }

        bytes32 message = signingMessage(authenticatorData, challenge, clientDataFields);

        success = P256_VERIFIER.verifySignature(message, r, s, qx, qy);
    }
}
