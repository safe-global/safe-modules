// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import {IP256Verifier, P256} from "./P256.sol";

/**
 * @title WebAuthn Signature Verification
 * @dev Library for verifying WebAuthn signatures for public key credentials using the ES256
 * algorithm.
 * @custom:security-contact bounty@safe.global
 */
library WebAuthn {
    using P256 for IP256Verifier;

    string internal constant ENCODING_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    /**
     * @notice The WebAuthn signature data format.
     * @dev WebAuthn signatures are expected to be the ABI-encoded bytes of the following structure.
     * @param authenticatorData The authenticator data from the WebAuthn credential assertion.
     * @param clientDataFields The additional fields from the client data JSON. This is the comma
     * separated fields as they appear in the client data JSON from the WebAuthn credential
     * assertion after the leading {type} and {challenge} fields.
     * @param r The ECDSA signature's R component.
     * @param s The ECDSA signature's S component.
     */
    struct Signature {
        bytes authenticatorData;
        string clientDataFields;
        uint256 r;
        uint256 s;
    }

    /**
     * @notice A WebAuthn authenticator bit-flags
     * @dev Represents flags that are included in a WebAuthn assertion's authenticator data and can
     * be used to check on-chain how the user was authorized by the device when signing.
     */
    type AuthenticatorFlags is bytes1;

    /**
     * @notice Authenticator data flag indicating user presence (UP).
     * @dev A test of user presence is a simple form of authorization gesture and technical process
     * where a user interacts with an authenticator by (typically) simply touching it (other
     * modalities may also exist), yielding a Boolean result. Note that this does not constitute
     * user verification because a user presence test, by definition, is not capable of biometric
     * recognition, nor does it involve the presentation of a shared secret such as a password or
     * PIN.
     *
     * See <https://www.w3.org/TR/webauthn-2/#test-of-user-presence>.
     */
    AuthenticatorFlags internal constant USER_PRESENCE = AuthenticatorFlags.wrap(0x01);

    /**
     * @notice Authenticator data flag indicating user verification (UV).
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
    AuthenticatorFlags internal constant USER_VERIFICATION = AuthenticatorFlags.wrap(0x04);

    /**
     * @notice Casts calldata bytes to a WebAuthn signature data structure.
     * @param signature The calldata bytes of the WebAuthn signature.
     * @return data A pointer to the signature data in calldata.
     * @dev This method casts the dynamic bytes array to a signature calldata pointer without
     * additional verification. This is not a security issue for the WebAuthn implementation, as any
     * signature data that would be represented from an invalid `signature` value, could also be
     * encoded by a valid one. It does, however, mean that callers into the WebAuthn signature
     * verification implementation might not validate as much of the data that they pass in as they
     * would expect. With that in mind, callers should not rely on the encoding being verified.
     */
    function castSignature(bytes calldata signature) internal pure returns (Signature calldata data) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            data := signature.offset
        }
    }

    /**
     * @notice Generate a signing message based on the authenticator data, challenge, and client
     * data fields.
     * @dev The signing message are the 32-bytes that are actually signed by the P-256 private key
     * when doing a WebAuthn credential assertion. Note that we verify that the challenge is indeed
     * signed by using its value to compute the signing message on-chain.
     * @param challenge The WebAuthn challenge used for the credential assertion.
     * @param authenticatorData Authenticator data.
     * @param clientDataFields Client data fields.
     * @return message Signing message.
     */
    function signingMessage(
        bytes32 challenge,
        bytes calldata authenticatorData,
        string calldata clientDataFields
    ) internal pure returns (bytes32 message) {
        /* solhint-disable quotes */
        // AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA is placeholder for the encoded challenge
        bytes memory clientDataJson = abi.encodePacked(
            '{"type":"webauthn.get","challenge":"',
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            '",',
            clientDataFields,
            "}"
        );

        string memory table = ENCODING_TABLE;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Skip first 32 bytes of the table containing the length
            let tablePtr := add(table, 1)
            // Skip first 36 bytes of the clientDataJson containing '{"type":"webauthn.get","challenge":"'
            let resultPtr := add(clientDataJson, 68)

            // Store group of 6 bits from the challenge to be encoded. Storing of 6 bits group can be removed but, kept here for readability.
            let sixBitGroup

            // Iterate over challenge in group of 6 bits, for each 6 bits lookup the ENCODING_TABLE, transform it and store it in the result
            for {
                let i := 250
            } lt(i, 251) {
                i := sub(i, 6)
            } {
                sixBitGroup := and(shr(i, challenge), 0x3F)
                mstore8(resultPtr, mload(add(tablePtr, sixBitGroup)))
                resultPtr := add(resultPtr, 1)
            }

            // Load the remaining last 4 bits of challenge that are yet to be encoded and then shift left to add 2 bits at the end to make it a group of 6 bits.
            sixBitGroup := shl(2, and(challenge, 0x0F))
            mstore8(resultPtr, mload(add(tablePtr, sixBitGroup)))
        }

        /* solhint-enable quotes */
        message = sha256(abi.encodePacked(authenticatorData, sha256(clientDataJson)));
    }

    /**
     * @notice Checks that the required authenticator data flags are set.
     * @param authenticatorData The authenticator data.
     * @param authenticatorFlags The authenticator flags to check for.
     * @return success Whether the authenticator data flags are set.
     */
    function checkAuthenticatorFlags(
        bytes calldata authenticatorData,
        AuthenticatorFlags authenticatorFlags
    ) internal pure returns (bool success) {
        success = authenticatorData[32] & AuthenticatorFlags.unwrap(authenticatorFlags) == AuthenticatorFlags.unwrap(authenticatorFlags);
    }

    /**
     * @notice Verifies a WebAuthn signature.
     * @param challenge The WebAuthn challenge used in the credential assertion.
     * @param signature The encoded WebAuthn signature bytes.
     * @param authenticatorFlags The authenticator data flags that must be set.
     * @param x The x-coordinate of the credential's public key.
     * @param y The y-coordinate of the credential's public key.
     * @param verifier The P-256 verifier implementation to use.
     * @return success Whether the signature is valid.
     */
    function verifySignature(
        bytes32 challenge,
        bytes calldata signature,
        AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        IP256Verifier verifier
    ) internal view returns (bool success) {
        success = verifySignature(challenge, castSignature(signature), authenticatorFlags, x, y, verifier);
    }

    /**
     * @notice Verifies a WebAuthn signature.
     * @param challenge The WebAuthn challenge used in the credential assertion.
     * @param signature The WebAuthn signature data.
     * @param authenticatorFlags The authenticator data flags that must be set.
     * @param x The x-coordinate of the credential's public key.
     * @param y The y-coordinate of the credential's public key.
     * @param verifier The P-256 verifier implementation to use.
     * @return success Whether the signature is valid.
     */
    function verifySignature(
        bytes32 challenge,
        Signature calldata signature,
        AuthenticatorFlags authenticatorFlags,
        uint256 x,
        uint256 y,
        IP256Verifier verifier
    ) internal view returns (bool success) {
        if (!checkAuthenticatorFlags(signature.authenticatorData, authenticatorFlags)) {
            return false;
        }

        bytes32 message = signingMessage(challenge, signature.authenticatorData, signature.clientDataFields);
        success = verifier.verifySignatureAllowMalleability(message, signature.r, signature.s, x, y);
    }
}
