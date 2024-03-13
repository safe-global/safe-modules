// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {IP256Verifier, P256VerifierLib} from "./IP256Verifier.sol";

/**
 * @title WebAuthnConstants
 * @dev Library that defines constants for WebAuthn verification.
 */
library WebAuthnConstants {
    /**
     * @dev Constants representing the flags in the authenticator data of a WebAuthn verification.
     *
     * - `AUTH_DATA_FLAGS_UP`: User Presence (UP) flag in the authenticator data.
     * - `AUTH_DATA_FLAGS_UV`: User Verification (UV) flag in the authenticator data.
     * - `AUTH_DATA_FLAGS_BE`: Attested Credential Data (BE) flag in the authenticator data.
     * - `AUTH_DATA_FLAGS_BS`: Extension Data (BS) flag in the authenticator data.
     */
    bytes1 internal constant AUTH_DATA_FLAGS_UP = 0x01;
    bytes1 internal constant AUTH_DATA_FLAGS_UV = 0x04;
    bytes1 internal constant AUTH_DATA_FLAGS_BE = 0x08;
    bytes1 internal constant AUTH_DATA_FLAGS_BS = 0x10;
}

/**
 * @title IWebAuthnVerifier
 * @dev Interface for verifying WebAuthn signatures.
 */
interface IWebAuthnVerifier {
    /**
     * @dev Verifies a WebAuthn signature allowing malleability.
     * @param authenticatorData The authenticator data.
     * @param authenticatorFlags The authenticator flags.
     * @param challenge The challenge.
     * @param clientDataFields The client data fields.
     * @param rs The signature components.
     * @param qx The x-coordinate of the public key.
     * @param qy The y-coordinate of the public key.
     * @return A boolean indicating whether the signature is valid.
     */
    function verifyWebAuthnSignatureAllowMalleability(
        bytes calldata authenticatorData,
        bytes1 authenticatorFlags,
        bytes32 challenge,
        bytes calldata clientDataFields,
        uint256[2] calldata rs,
        uint256 qx,
        uint256 qy
    ) external view returns (bool);

    /**
     * @dev Verifies a WebAuthn signature.
     * @param authenticatorData The authenticator data.
     * @param authenticatorFlags The authenticator flags.
     * @param challenge The challenge.
     * @param clientDataFields The client data fields.
     * @param rs The signature components.
     * @param qx The x-coordinate of the public key.
     * @param qy The y-coordinate of the public key.
     * @return A boolean indicating whether the signature is valid.
     */
    function verifyWebAuthnSignature(
        bytes calldata authenticatorData,
        bytes1 authenticatorFlags,
        bytes32 challenge,
        bytes calldata clientDataFields,
        uint256[2] calldata rs,
        uint256 qx,
        uint256 qy
    ) external view returns (bool);
}

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
 */
contract WebAuthnVerifier is IWebAuthnVerifier {
    IP256Verifier internal immutable P256_VERIFIER;

    string internal constant ENCODING_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

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
        /* solhint-disable quotes */
        // AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA is placeholder for the encoded challenge
        bytes memory clientDataJson = abi.encodePacked(
            '{"type":"webauthn.get","challenge":"',
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            '",',
            clientDataFields,
            "}"
        );

        string memory table = ENCODING_TABLE;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Skip first 32 bytes of the table containing the length
            let tablePtr := add(table, 1)
            // Skip first 36 bytes of the clientDataJson containing '{"type":"webauthn.get","challenge":"'
            let resultPtr := add(clientDataJson, 68)

            // Store group of 6 bits from the challenge to be encoded. Storing of 6 bits group can be removed but, kept here for readability.
            let sixBitGroup

            // Iterate over challenge in group of 6 bits, for each 6 bits lookup the ENCODING_TABLE, transform it and store it in the result
            for {
                let i := 250
            } lt(i, 251) {
                i := sub(i, 6)
            } {
                sixBitGroup := and(shr(i, challenge), 0x3F)
                mstore8(resultPtr, mload(add(tablePtr, sixBitGroup)))
                resultPtr := add(resultPtr, 1)
            }

            // Load the remaining last 4 bits of challenge that are yet to be encoded and then shift left to add 2 bits at the end to make it a group of 6 bits.
            sixBitGroup := shl(2, and(challenge, 0x0F))
            mstore8(resultPtr, mload(add(tablePtr, sixBitGroup)))
        }

        /* solhint-enable quotes */
        message = sha256(abi.encodePacked(authenticatorData, sha256(clientDataJson)));
    }

    /**
     * @dev Verifies the signature of a WebAuthn message using P256 elliptic curve, allowing for signature malleability.
     * @param authenticatorData Authenticator data.
     * @param authenticatorFlags Authenticator flags.
     * @param challenge Challenge.
     * @param clientDataFields Client data fields.
     * @param rs R and S components of the signature.
     * @param qx X coordinate of the public key.
     * @param qy Y coordinate of the public key.
     * @return result Whether the signature is valid.
     */
    function verifyWebAuthnSignatureAllowMalleability(
        bytes calldata authenticatorData,
        bytes1 authenticatorFlags,
        bytes32 challenge,
        bytes calldata clientDataFields,
        uint256[2] calldata rs,
        uint256 qx,
        uint256 qy
    ) public view returns (bool result) {
        // check authenticator flags, e.g. for User Presence (0x01) and/or User Verification (0x04)
        if ((authenticatorData[32] & authenticatorFlags) != authenticatorFlags) {
            return false;
        }

        bytes32 message = signingMessage(authenticatorData, challenge, clientDataFields);

        result = P256VerifierLib.verifySignatureAllowMalleability(P256_VERIFIER, message, rs[0], rs[1], qx, qy);
    }

    /**
     * @dev Verifies the signature of a WebAuthn message using the P256 elliptic curve, checking for signature malleability.
     * @param authenticatorData Authenticator data.
     * @param authenticatorFlags Authenticator flags.
     * @param challenge Challenge.
     * @param clientDataFields Client data fields.
     * @param rs R and S components of the signature.
     * @param qx X coordinate of the public key.
     * @param qy Y coordinate of the public key.
     * @return result Whether the signature is valid.
     */
    function verifyWebAuthnSignature(
        bytes calldata authenticatorData,
        bytes1 authenticatorFlags,
        bytes32 challenge,
        bytes calldata clientDataFields,
        uint256[2] calldata rs,
        uint256 qx,
        uint256 qy
    ) public view returns (bool result) {
        // check authenticator flags, e.g. for User Presence (0x01) and/or User Verification (0x04)
        if ((authenticatorData[32] & authenticatorFlags) != authenticatorFlags) {
            return false;
        }

        bytes32 message = signingMessage(authenticatorData, challenge, clientDataFields);

        result = P256VerifierLib.verifySignature(P256_VERIFIER, message, rs[0], rs[1], qx, qy);
    }
}
