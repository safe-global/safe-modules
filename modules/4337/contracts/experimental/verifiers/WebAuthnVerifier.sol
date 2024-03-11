// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {P256Wrapper} from "./P256Wrapper.sol";

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
contract WebAuthnVerifier is IWebAuthnVerifier, P256Wrapper {
    constructor(address verifier) P256Wrapper(verifier) {}

    string internal constant ENCODING_TABLE =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

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

        // Result is 44 bytes long because the encoded challenge is 32 bytes long
        // 4*(32 + 2)/3 = 44 after rounding.
        string memory table = ENCODING_TABLE;
        string memory encodedChallenge = new string(44);

        assembly {
            // Skip first 32 bytes of the table containing the length
            let tablePtr := add(table, 1)
            // Skip first 32 bytes of the encodedChallenge containing the length
            let resultPtr := add(encodedChallenge, 32)

            // Temporarily stores 3 bytes of challenge
            let buffer
            for{let i:= 0} lt(i, 10)
            {
                i := add(i, 1)
            }{
                // Calculate the shift value to get the 3 bytes of challenge
                let shift := sub(256, mul(add(i, 1), 24))
                buffer := and(shr(shift, challenge), 0xFFFFFF)

                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, buffer), 0x3F))))
                resultPtr := add(resultPtr, 1)

                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, buffer), 0x3F))))
                resultPtr := add(resultPtr, 1)

                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, buffer), 0x3F))))
                resultPtr := add(resultPtr, 1)

                mstore8(resultPtr, mload(add(tablePtr, and(buffer, 0x3F))))
                resultPtr := add(resultPtr, 1)
           }
                
                // As 32 bytes input is not divisible by 3, process last 2 bytes of challenge separately
                buffer := shl(8, and(challenge, 0xFFFF))

                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, buffer), 0x3F))))
                resultPtr := add(resultPtr, 1)

                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, buffer), 0x3F))))
                resultPtr := add(resultPtr, 1)

                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, buffer), 0x3F))))
                resultPtr := add(resultPtr, 1)

                mstore8(resultPtr, mload(add(tablePtr, and(buffer, 0x3F))))
                resultPtr := add(resultPtr, 1)

                // Because the input is fixed 32 bytes long
                resultPtr := sub(resultPtr, 1)
                mstore(encodedChallenge, sub(resultPtr, add(encodedChallenge, 32)))
        }

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

        result = verifySignatureAllowMalleability(message, rs[0], rs[1], qx, qy);
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
        // check for signature malleability
        if (rs[1] > _P256_N_DIV_2) {
            return false;
        }

        result = verifyWebAuthnSignatureAllowMalleability(authenticatorData, authenticatorFlags, challenge, clientDataFields, rs, qx, qy);
    }
}
