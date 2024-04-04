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
     * @notice Encodes the client data JSON string from the specified challenge, and additional
     * client data fields.
     * @dev The client data JSON follows a very specific encoding process outlined in the Web
     * Authentication standard. See <https://w3c.github.io/webauthn/#clientdatajson-serialization>.
     * @param challenge The WebAuthn challenge used for the credential assertion.
     * @param clientDataFields Client data fields.
     * @return clientDataJson The encoded client data JSON.
     */
    function encodeClientDataJson(
        bytes32 challenge,
        string calldata clientDataFields
    ) internal pure returns (string memory clientDataJson) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            // The length of the encoded JSON string. This is always 82 plus the length of the
            // additional client data fields:
            // - 36 bytes for: `{"type":"webauthn.get","challenge":"`
            // - 43 bytes for base-64 encoding of 32 bytes of data
            // - 2 bytes for: `",`
            // - `clientDataFields.length` bytes for the additional client data JSON fields
            // - 1 byte for: `}`
            let encodedLength := add(82, clientDataFields.length)

            // Set `clientDataJson` return parameter to point to the start of the free memory.
            // This is where the encoded JSON will be stored.
            clientDataJson := mload(0x40)

            // Write the constant bytes of the encoded client data JSON string as per the JSON
            // serialization specification. Note that we write the data backwards, this is to avoid
            // overwriting previously written data with zeros. Offsets are computed to account for
            // both the leading 32-byte length and leading zeros from the constants.
            mstore(add(clientDataJson, encodedLength), 0x7d) // }
            mstore(add(clientDataJson, 81), 0x222c) // ",
            mstore(add(clientDataJson, 36), 0x2c226368616c6c656e6765223a22) // ,"challenge":"
            mstore(add(clientDataJson, 22), 0x7b2274797065223a22776562617574686e2e67657422) // {"type":"webauthn.get"
            mstore(clientDataJson, encodedLength)

            // Copy the client data fields from calldata to their reserved space in memory.
            calldatacopy(add(clientDataJson, 113), clientDataFields.offset, clientDataFields.length)

            // Store the base-64 URL character lookup table into the scratch and free memory pointer
            // space in memory [^1]. The table is split into two 32-byte parts and stored in memory
            // from address 0x1f to 0x5e. Note that the offset is chosen in such a way that the
            // least significant byte of `mload(x)` is the base-64 ASCII character for the 6-bit
            // value `x`. We will write the free memory pointer at address `0x40` before leaving the
            // assembly block accounting for the allocation of `clientDataJson`.
            //
            // - [^1](https://docs.soliditylang.org/en/stable/internals/layout_in_memory.html).
            mstore(0x1f, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef")
            mstore(0x3f, "ghijklmnopqrstuvwxyz0123456789-_")

            // Initialize a pointer for writing the base-64 encoded challenge.
            let ptr := add(clientDataJson, 68)

            // Base-64 encode the challenge to its reserved space in memory.
            //
            // To minimize stack and jump operations, we partially unroll the loop. With full 6
            // iterations of the loop, we need to encode seven 6-bit groups and one 4-bit group. In
            // total, it encodes 6 iterations * 7 groups * 6 bits = 252 bits. The remaining 4-bit
            // group is encoded after the loop. `i` is initialized to 250, which is the number of
            // bits by which we need to shift the data to get the first 6-bit group, and then we
            // subtract 6 to get the next 6-bit group.
            //
            // We want to exit when all full 6 bits groups are encoded. After 6 iterations, `i` will
            // be -2 and the **signed** comparison with 0 will break the loop.
            for {
                let i := 250
            } sgt(i, 0) {
                // Advance the pointer by the number of bytes written (7 bytes in this case).
                ptr := add(ptr, 7)
                // Move `i` by 42 = 6 bits * 7 (groups processed in each iteration).
                i := sub(i, 42)
            } {
                // Encode 6-bit groups into characters by looking them up in the character table.
                // 0x3f is a mask to get the last 6 bits so that we can index directly to the
                // base-64 lookup table.
                mstore8(ptr, mload(and(shr(i, challenge), 0x3f)))
                mstore8(add(ptr, 1), mload(and(shr(sub(i, 6), challenge), 0x3f)))
                mstore8(add(ptr, 2), mload(and(shr(sub(i, 12), challenge), 0x3f)))
                mstore8(add(ptr, 3), mload(and(shr(sub(i, 18), challenge), 0x3f)))
                mstore8(add(ptr, 4), mload(and(shr(sub(i, 24), challenge), 0x3f)))
                mstore8(add(ptr, 5), mload(and(shr(sub(i, 30), challenge), 0x3f)))
                mstore8(add(ptr, 6), mload(and(shr(sub(i, 36), challenge), 0x3f)))
            }

            // Encode the final 4-bit group, where 0x0f is a mask to get the last 4 bits.
            mstore8(ptr, mload(shl(2, and(challenge, 0x0f))))

            // Update the free memory pointer to point to the end of the encoded string.
            // Store the length of the encoded string at the beginning of `result`.
            mstore(0x40, and(add(clientDataJson, add(encodedLength, 0x3f)), not(0x1f)))
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
        string memory clientDataJson = encodeClientDataJson(challenge, clientDataFields);
        message = sha256(abi.encodePacked(authenticatorData, sha256(bytes(clientDataJson))));
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
