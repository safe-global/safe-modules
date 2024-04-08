// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SignatureValidator} from "./base/SignatureValidator.sol";
import {IP256Verifier} from "./interfaces/IP256Verifier.sol";
import {WebAuthn} from "./libraries/WebAuthn.sol";

/**
 * @title WebAuthn Safe Signature Validator Singleton
 * @dev A contract that represents a WebAuthn signer.
 * @custom:security-contact bounty@safe.global
 */
contract SafeWebAuthnSignerSingleton is SignatureValidator {
    address public singleton;
    uint256 public x;
    uint256 public y;
    IP256Verifier public verifier;

    // TODO: Constructor to disable use of singleton for signature verification

    /**
     * @dev Setup function.
     * @param _x The X coordinate of the signer's public key.
     * @param _y The Y coordinate of the signer's public key.
     * @param _verifier The P-256 verifier to use for signature validation. It MUST implement the
     * same interface as the EIP-7212 precompile.
     */
    function setup(uint256 _x, uint256 _y, address _verifier) external {
        require(x == 0, "SafeWebAuthnSigner: already initialized");
        x = _x;
        y = _y;
        verifier = IP256Verifier(_verifier);
    }

    /**
     * @inheritdoc SignatureValidator
     */
    function _verifySignature(bytes32 message, bytes calldata signature) internal view virtual override returns (bool success) {
        success = WebAuthn.verifySignature(message, signature, WebAuthn.USER_VERIFICATION, x, y, verifier);
    }
}
