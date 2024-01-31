// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {FCL_ecdsa} from "../vendor/FCL/FCL_ecdsa.sol";

/**
 * @title P256VerifierWithFallback
 * @dev A contract that implements a P256 elliptic curve signature verification following the precompile's interface.
 * The contract provides a fallback function that takes a specific input format and returns a result indicating
 * whether the signature is valid or not.
 * The input format is as follows:
 * - input[  0: 32] = signed data hash
 * - input[ 32: 64] = signature r
 * - input[ 64: 96] = signature s
 * - input[ 96:128] = public key x
 * - input[128:160] = public key y
 * The result is a bytes array where the first 32 bytes represent 0x00..00 (invalid) or 0x00..01 (valid).
 * For more details, refer to the EIP-7212 specification: https://eips.ethereum.org/EIPS/eip-7212
 */
contract P256Verifier {
    fallback(bytes calldata input) external returns (bytes memory) {
        if (input.length != 160) {
            return abi.encodePacked(uint256(0));
        }

        bytes32 hash = bytes32(input[0:32]);
        uint256 r = uint256(bytes32(input[32:64]));
        uint256 s = uint256(bytes32(input[64:96]));
        uint256 x = uint256(bytes32(input[96:128]));
        uint256 y = uint256(bytes32(input[128:160]));

        uint256 ret = FCL_ecdsa.ecdsa_verify(hash, r, s, x, y) ? 1 : 0;

        return abi.encodePacked(ret);
    }
}

/**
 * @title P256VerifierWithWrapperFunctions
 * @dev A contract that implements a P256 elliptic curve signature verification following the precompile's interface.
 * The contract also provides wrapper functions from the EIP-7212 specification.
 *
 * This contract is designed to allow inheriting from it and using the wrapper functions in the inheriting contract, thus avoiding an extra call to the verifier.
 * It works really well for signing schemes that use the same curve and hash function but require a different message format, e.g., WebAuthn.
 *
 * The contract provides two main functions:
 * - `verifySignatureAllowMalleability`: Verifies the signature of a message using P256 elliptic curve, allowing for signature malleability.
 * - `verifySignature`: Verifies the signature of a message using the P256 elliptic curve, checking for signature malleability.
 *
 * Both functions take the message hash, r, s, x, and y components of the signature and public key as input.
 * The `verifySignature` function also checks for signature malleability by ensuring that the s component is less than the curve order n/2.
 */
abstract contract P256VerifierWithWrapperFunctions is P256Verifier {
    /// P256 curve order n/2 for malleability check
    uint256 constant P256_N_DIV_2 = 57896044605178124381348723474703786764998477612067880171211129530534256022184;

    /**
     * @dev Verifies the signature of a message using P256 elliptic curve.
     * @param messageHash The hash of the message to be verified.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @return A boolean indicating whether the signature is valid or not.
     */
    function verifySignatureAllowMalleability(
        bytes32 messageHash,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        return FCL_ecdsa.ecdsa_verify(messageHash, r, s, x, y);
    }

    /**
     * @dev Verifies the signature of a message using the P256 elliptic curve.
     * @param message_hash The hash of the message to be verified.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @return A boolean indicating whether the signature is valid.
     */
    function verifySignature(bytes32 message_hash, uint256 r, uint256 s, uint256 x, uint256 y) internal view returns (bool) {
        // check for signature malleability
        if (s > P256_N_DIV_2) {
            return false;
        }

        return verifySignatureAllowMalleability(message_hash, r, s, x, y);
    }
}
