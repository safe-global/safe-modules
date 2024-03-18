// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SignatureValidator} from "./base/SignatureValidator.sol";
import {IWebAuthnVerifier} from "./interfaces/IWebAuthnVerifier.sol";
import {WebAuthnFlags} from "./libraries/WebAuthnFlags.sol";
import {WebAuthnSignature} from "./libraries/WebAuthnSignature.sol";

/**
 * @title WebAuthn Safe Signature Validator
 * @dev A contract that represents a WebAuthn signer.
 * @custom:security-contact bounty@safe.global
 */
contract WebAuthnSigner is SignatureValidator {
    uint256 public immutable X;
    uint256 public immutable Y;
    IWebAuthnVerifier public immutable WEBAUTHN_SIG_VERIFIER;

    /**
     * @dev Constructor function.
     * @param qx The X coordinate of the signer's public key.
     * @param qy The Y coordinate of the signer's public key.
     * @param webAuthnVerifier The address of the P256Verifier contract.
     */
    constructor(uint256 qx, uint256 qy, address webAuthnVerifier) {
        X = qx;
        Y = qy;
        WEBAUTHN_SIG_VERIFIER = IWebAuthnVerifier(webAuthnVerifier);
    }

    /**
     * @inheritdoc SignatureValidator
     */
    function _verifySignature(bytes32 message, bytes calldata signature) internal view virtual override returns (bool isValid) {
        WebAuthnSignature.Data calldata data = WebAuthnSignature.cast(signature);

        return
            WEBAUTHN_SIG_VERIFIER.verifyWebAuthnSignatureAllowMalleability(
                data.authenticatorData,
                WebAuthnFlags.USER_VERIFICATION,
                message,
                data.clientDataFields,
                data.r,
                data.s,
                X,
                Y
            );
    }
}
