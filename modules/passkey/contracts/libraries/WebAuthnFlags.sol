// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

/**
 * @title WebAuthn Authentication Data Flags
 * @dev Library that defines constants for WebAuthn verification of the authenticator data. In
 * particular, it defines constants representing user flags that are included in an attestation's
 * authenticator data.
 * @custom:security-contact bounty@safe.global
 */
library WebAuthnFlags {
    /**
     * @notice Flag indicating user presence (UP).
     * @dev A test of user presence is a simple form of authorization gesture and technical process
     * where a user interacts with an authenticator by (typically) simply touching it (other
     * modalities may also exist), yielding a Boolean result. Note that this does not constitute
     * user verification because a user presence test, by definition, is not capable of biometric
     * recognition, nor does it involve the presentation of a shared secret such as a password or
     * PIN.
     *
     * See <https://www.w3.org/TR/webauthn-2/#test-of-user-presence>.
     */
    bytes1 internal constant USER_PRESENCE = 0x01;

    /**
     * @notice Flag indicating user verification (UV).
     * @dev The technical process by which an authenticator locally authorizes the invocation of the
     * authenticatorMakeCredential and authenticatorGetAssertion operations. User verification MAY
     * be instigated through various authorization gesture modalities; for example, through a touch
     * plus pin code, password entry, or biometric recognition (e.g., presenting a fingerprint). The
     * intent is to distinguish individual users.
     *
     * Note that user verification does not give the Relying Party a concrete identification of the
     * user, but when 2 or more ceremonies with user verification have been done with that
     * credential it expresses that it was the same user that performed all of them. The same user
     * might not always be the same natural person, however, if multiple natural persons share
     * access to the same authenticator.
     *
     * See <https://www.w3.org/TR/webauthn-2/#user-verification>.
     */
    bytes1 internal constant USER_VERIFICATION = 0x04;
}
