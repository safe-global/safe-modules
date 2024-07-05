// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import {SignatureValidator} from "./base/SignatureValidator.sol";
import {P256, WebAuthn} from "./libraries/WebAuthn.sol";

/**
 * @title Safe WebAuthn Signer Singleton
 * @dev A singleton contract that implements WebAuthn signature verification. This singleton
 * contract must be used with the specialized proxy {SafeWebAuthnSignerProxy}, as it encodes the
 * credential configuration (public key coordinates and P-256 verifier to use) in calldata, which is
 * required by this implementation.
 * @custom:security-contact bounty@safe.global
 */
contract SafeWebAuthnSignerSingleton is SignatureValidator {
    /**
     * @inheritdoc SignatureValidator
     */
    function _verifySignature(bytes32 message, bytes calldata signature) internal view virtual override returns (bool success) {
        (uint256 x, uint256 y, P256.Verifiers verifiers) = getConfiguration();
        success = WebAuthn.verifySignature(message, signature, WebAuthn.USER_VERIFICATION, x, y, verifiers);
    }

    /**
     * @notice Returns the x coordinate, y coordinate, and P-256 verifiers used for ECDSA signature
     * validation. The values are expected to appended to calldata by the caller. See the
     * {SafeWebAuthnSignerProxy} contract implementation.
     * @return x The x coordinate of the P-256 public key.
     * @return y The y coordinate of the P-256 public key.
     * @return verifiers The P-256 verifiers.
     */
    function getConfiguration() public pure returns (uint256 x, uint256 y, P256.Verifiers verifiers) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            x := calldataload(sub(calldatasize(), 86))
            y := calldataload(sub(calldatasize(), 54))
            verifiers := shr(80, calldataload(sub(calldatasize(), 22)))
        }
    }
}
