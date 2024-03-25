// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SignatureValidator} from "./base/SignatureValidator.sol";
import {IP256Verifier} from "./interfaces/IP256Verifier.sol";
import {WebAuthn} from "./libraries/WebAuthn.sol";

/**
 * @title WebAuthn Safe Signature Validator
 * @dev A contract that represents a WebAuthn signer.
 * @custom:security-contact bounty@safe.global
 */
contract WebAuthnSigner is SignatureValidator {
    uint256 public immutable X;
    uint256 public immutable Y;
    IP256Verifier public immutable VERIFIER;

    /**
     * @dev Constructor function.
     * @param x The X coordinate of the signer's public key.
     * @param y The Y coordinate of the signer's public key.
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
