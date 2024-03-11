// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

/**
 * @title WebAuthn Signature Format
 * @dev Library for reading the standard Safe WebAuthn signature format from calldata bytes.
 * @custom:security-contact bounty@safe.global
 */
library WebAuthnSignature {
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
    struct Data {
        bytes authenticatorData;
        bytes clientDataFields;
        uint256 r;
        uint256 s;
    }

    /**
     * @notice Casts calldata bytes to a WebAuthn signature data structure.
     * @param signature The calldata bytes of the WebAuthn signature.
     * @return data A pointer to the signature data in calldata.
     * @dev This method casts the dynamic bytes array to a signature calldata pointer without
     * additional verification. This is not a security issue for the WebAuthn implementation, as any
     * signature data that would be represented from an invalid `signature` value, could also be
     * encoded by a valid one. It does, however, mean that callers into the WebAuthn signature
     * verification implementation might not validate as much of the data that they pass in as they
     * would expect, but we do not believe this to be an issue.
     */
    function cast(bytes calldata signature) internal pure returns (Data calldata data) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            data := signature.offset
        }
    }
}
