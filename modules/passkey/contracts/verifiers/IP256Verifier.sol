// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable payable-fallback */
pragma solidity ^0.8.0;

/**
 * @title P-256 Elliptic Curve Verifier.
 * @dev P-256 verifier contract that follows the EIP-7212 EC verify precompile interface. For more
 * details, refer to the EIP-7212 specification: <https://eips.ethereum.org/EIPS/eip-7212>
 * @custom:security-contact bounty@safe.global
 */
interface IP256Verifier {
    /**
     * @notice  A fallback function that takes the following input format and returns a result
     * indicating whether the signature is valid or not:
     * - `input[  0: 32]`: message
     * - `input[ 32: 64]`: signature r
     * - `input[ 64: 96]`: signature s
     * - `input[ 96:128]`: public key x
     * - `input[128:160]`: public key y
     *
     * The output is a Solidity ABI encoded boolean value indicating whether or not the signature is
     * valid. Specifically, it returns 32 bytes with a value of `0x00..00` or `0x00..01` for an
     * invalid or valid signature respectively.
     *
     * Note that this function does not follow the Solidity ABI format (in particular, it does not
     * have a 4-byte selector), which is why it requires a fallback function and not regular
     * Solidity function. Additionally, it has `view` function semantics, and is expected to be
     * called with `STATICCALL` opcode.
     *
     * @param input The encoded input parameters.
     * @return output The encoded signature verification result.
     */
    fallback(bytes calldata input) external returns (bytes memory output);
}

/**
 * @title P-256 Elliptic Curve Verifier.
 * @dev P-256 verifier contract that follows the EIP-7212 EC verify precompile interface. For more
 * details, refer to the EIP-7212 specification: <https://eips.ethereum.org/EIPS/eip-7212>
 */
library P256VerifierLib {
    /**
     * @notice P-256 curve order n divided by 2 for the signature malleability check.
     * @dev By convention, non-malleable signatures must have an `s` value that is less than half of
     * the curve order.
     */
    uint256 internal constant _N_DIV_2 = 57896044605178124381348723474703786764998477612067880171211129530534256022184;

    /**
     * @notice Verifies the signature of a message using the P256 elliptic curve with signature
     * malleability check.
     * @dev Note that a signature is valid for both `+s` and `-s`, making it trivial to, given a
     * signature, generate another valid signature by flipping the sign of the `s` value in the
     * prime field defined by the P-256 curve order `n`. This signature verification method checks
     * that `1 <= s <= n/2` to prevent malleability, such that there is a unique `s` value that is
     * accepted for a given signature. Note that for many protocols, signature malleability is not
     * an issue, so the use of {verifySignatureAllowMalleability} as long as only that the signature
     * is valid is important, and not its actual value.
     * @param verifier The P-256 verifier.
     * @param message The signed message.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @return success A boolean indicating whether the signature is valid or not.
     */
    function verifySignature(
        IP256Verifier verifier,
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool success) {
        if (s > _N_DIV_2) {
            return false;
        }

        success = verifySignatureAllowMalleability(verifier, message, r, s, x, y);
    }

    /**
     * @notice Verifies the signature of a message using P256 elliptic curve, without signature
     * malleability check.
     * @param verifier The P-256 verifier.
     * @param message The signed message.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @return success A boolean indicating whether the signature is valid or not.
     */
    function verifySignatureAllowMalleability(
        IP256Verifier verifier,
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool success) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            // Prepare input for staticcall
            let input := mload(0x40) // Free memory pointer
            mstore(input, message)
            mstore(add(input, 32), r)
            mstore(add(input, 64), s)
            mstore(add(input, 96), x)
            mstore(add(input, 128), y)

            // Perform staticcall
            success := staticcall(gas(), verifier, input, 160, 0, 32)

            // Check for success and return value
            if iszero(and(success, eq(returndatasize(), 32))) {
                revert(0, 0)
            }
            success := mload(0)
        }
    }
}
