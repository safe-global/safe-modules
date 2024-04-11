// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SignatureValidator} from "./base/SignatureValidator.sol";
import {P256, WebAuthn} from "./libraries/WebAuthn.sol";

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
     * @notice The P-256 verifiers used for ECDSA signature validation.
     */
    P256.Verifiers public immutable VERIFIERS;

    /**
     * @dev Constructor function.
     * @param x The X coordinate of the P-256 public key of the WebAuthn credential.
     * @param y The Y coordinate of the P-256 public key of the WebAuthn credential.
     * @param verifiers The P-256 verifiers to use for signature validation. This is the
     * concatenation of `uint32(precompile) || address(fallback)` specifying the `precompile` to
     * use as well as the `fallback` Solidity P-256 verifier implementation in case the precompile
     * is not available.
     */
    constructor(uint256 x, uint256 y, P256.Verifiers verifiers) {
        X = x;
        Y = y;
        VERIFIERS = verifiers;
    }

    /**
     * @inheritdoc SignatureValidator
     */
    function _verifySignature(bytes32 message, bytes calldata signature) internal view virtual override returns (bool success) {
        success = WebAuthn.verifySignature(message, signature, WebAuthn.USER_VERIFICATION, X, Y, VERIFIERS);
    }
}
