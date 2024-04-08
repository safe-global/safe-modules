// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SignatureValidator} from "./base/SignatureValidator.sol";
import {IP256Verifier} from "./interfaces/IP256Verifier.sol";
import {WebAuthn} from "./libraries/WebAuthn.sol";

/**
 * @title WebAuthn Safe Signature Validator
 * @dev A Safe signature validator implementation for a WebAuthn P-256 credential.
 * @custom:security-contact bounty@safe.global
 */
contract SafeWebAuthnSigner is SignatureValidator {
    /**
     * @notice The X coordinate of the P-256 public key of the WebAuthn credential.
     */
    uint256 public immutable X;

    /**
     * @notice The Y coordinate of the P-256 public key of the WebAuthn credential.
     */
    uint256 public immutable Y;

    /**
     * @notice The P-256 verifier used for ECDSA signature validation.
     */
    IP256Verifier public immutable VERIFIER;

    /**
     * @dev Constructor function.
     * @param x The X coordinate of the P-256 public key of the WebAuthn credential.
     * @param y The Y coordinate of the P-256 public key of the WebAuthn credential.
     * @param verifier The P-256 verifier to use for signature validation. It MUST implement the
     * same interface as the EIP-7212 precompile.
     */
    constructor(uint256 x, uint256 y, address verifier) {
        X = x;
        Y = y;
        VERIFIER = IP256Verifier(verifier);
    }

    /**
     * @inheritdoc SignatureValidator
     */
    function _verifySignature(bytes32 message, bytes calldata signature) internal view virtual override returns (bool success) {
        success = WebAuthn.verifySignature(message, signature, WebAuthn.USER_VERIFICATION, X, Y, VERIFIER);
    }
}
