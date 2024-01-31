// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {P256Wrapper} from "./P256Wrapper.sol";
import {Base64Url} from "../vendor/FCL/utils/Base64Url.sol";

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
    bytes1 constant AUTH_DATA_FLAGS_UP = 0x01; 
    bytes1 constant AUTH_DATA_FLAGS_UV = 0x04;
    bytes1 constant AUTH_DATA_FLAGS_BE = 0x08; 
    bytes1 constant AUTH_DATA_FLAGS_BS = 0x10;
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

contract WebAuthnVerifier is IWebAuthnVerifier, P256Wrapper {
    constructor(address verifier) P256Wrapper(verifier) {}

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

        result = verifySignature(message, rs[0], rs[1], qx, qy);
    }
}

