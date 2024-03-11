// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable payable-fallback */
pragma solidity ^0.8.0;

/**
 * @title WebAuthn Verifier Interface
 * @dev Interface for verifying WebAuthn signatures.
 * @custom:security-contact bounty@safe.global
 */
interface IWebAuthnVerifier {
    /**
     * @dev Verifies a WebAuthn signature.
     * @param authenticatorData The authenticator data.
     * @param authenticatorFlags The authenticator flags.
     * @param challenge The challenge.
     * @param clientDataFields The client data fields.
     * @param r The ECDSA signature's R component.
     * @param s The ECDSA signature's S component.
     * @param qx The x-coordinate of the public key.
     * @param qy The y-coordinate of the public key.
     * @return success Whether the signature is valid.
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
    ) external view returns (bool success);

    /**
     * @dev Verifies a WebAuthn signature allowing malleability.
     * @param authenticatorData The authenticator data.
     * @param authenticatorFlags The authenticator flags.
     * @param challenge The challenge.
     * @param clientDataFields The client data fields.
     * @param r The ECDSA signature's R component.
     * @param s The ECDSA signature's S component.
     * @param qx The x-coordinate of the public key.
     * @param qy The y-coordinate of the public key.
     * @return success Whether the signature is valid.
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
    ) external view returns (bool success);
}
