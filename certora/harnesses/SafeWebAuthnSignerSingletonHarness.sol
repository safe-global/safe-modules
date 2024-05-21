// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SafeWebAuthnSignerSingleton} from "../../modules/passkey/contracts/SafeWebAuthnSignerSingleton.sol";
import {SignatureValidator} from "../../modules/passkey/contracts/base/SignatureValidator.sol";
import {P256, WebAuthn} from "../../modules/passkey/contracts/libraries/WebAuthn.sol";

/**
 * @title Safe WebAuthn Signer Singleton
 * @dev A singleton contract that implements WebAuthn signature verification. This singleton
 * contract must be used with the specialized proxy {SafeWebAuthnSignerProxy}, as it encodes the
 * credential configuration (public key coordinates and P-256 verifier to use) in calldata, which is
 * required by this implementation.
 * @custom:security-contact bounty@safe.global
 */
contract SafeWebAuthnSignerSingletonHarness is SafeWebAuthnSignerSingleton {
   
    function verifySignatureHarnessed(bytes32 message, bytes calldata signature) public view virtual returns (bool success) {
        (uint256 x, uint256 y, P256.Verifiers verifiers) = getConfiguration();
        success = WebAuthn.verifySignature(message, signature, WebAuthn.USER_VERIFICATION, x, y, verifiers);
    }
}
