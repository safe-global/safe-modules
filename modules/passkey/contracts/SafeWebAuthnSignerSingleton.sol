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
    /**
     * @inheritdoc SignatureValidator
     */
    function _verifySignature(
        bytes32 message,
        bytes calldata signature,
        uint256 x,
        uint256 y,
        address verifier
    ) internal view virtual override returns (bool success) {
        success = WebAuthn.verifySignature(message, signature, WebAuthn.USER_VERIFICATION, X, Y, VERIFIERS);
    }
}
