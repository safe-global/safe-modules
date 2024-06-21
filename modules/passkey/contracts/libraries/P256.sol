// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import {IP256Verifier} from "../interfaces/IP256Verifier.sol";

/**
 * @title P-256 Elliptic Curve Verification Library.
 * @dev Library P-256 verification with contracts that follows the EIP-7212 EC verify precompile
 * interface. See <https://eips.ethereum.org/EIPS/eip-7212>.
 * @custom:security-contact bounty@safe.global
 */
library P256 {
    /**
     * @notice P-256 curve order n divided by 2 for the signature malleability check.
     * @dev By convention, non-malleable signatures must have an `s` value that is less than half of
     * the curve order.
     */
    uint256 internal constant _N_DIV_2 = 57896044605178124381348723474703786764998477612067880171211129530534256022184;

    /**
     * @notice P-256 precompile and fallback verifiers.
     * @dev This is the packed `uint16(precompile) | uint160(fallback)` addresses to use for the
     * verifiers. This allows both a precompile and a fallback Solidity implementation of the P-256
     * curve to be specified. For networks where the P-256 precompile is planned to be enabled but
     * not yet available, this allows for a verifier to seamlessly start using the precompile once
     * it becomes available.
     */
    type Verifiers is uint176;

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
     * @notice Verifies the signature of a message using the P256 elliptic curve with signature
     * malleability check.
     * @param verifiers The P-256 verifiers to use.
     * @param message The signed message.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @return success A boolean indicating whether the signature is valid or not.
     */
    function verifySignature(
        Verifiers verifiers,
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool success) {
        if (s > _N_DIV_2) {
            return false;
        }

        success = verifySignatureAllowMalleability(verifiers, message, r, s, x, y);
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

            // Perform staticcall and check result, note that Yul evaluates expressions from right
            // to left. See <https://docs.soliditylang.org/en/v0.8.24/yul.html#function-calls>.
            mstore(0, 0)
            success := and(
                and(
                    // Return data is exactly 32-bytes long
                    eq(returndatasize(), 32),
                    // Return data is exactly the value 0x00..01
                    eq(mload(0), 1)
                ),
                // Call does not revert
                staticcall(gas(), verifier, input, 160, 0, 32)
            )
        }
    }

    /**
     * @notice Verifies the signature of a message using P256 elliptic curve, without signature
     * malleability check.
     * @param verifiers The P-256 verifiers to use.
     * @param message The signed message.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @return success A boolean indicating whether the signature is valid or not.
     */
    function verifySignatureAllowMalleability(
        Verifiers verifiers,
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool success) {
        address precompileVerifier = address(uint160(uint256(Verifiers.unwrap(verifiers)) >> 160));
        address fallbackVerifier = address(uint160(Verifiers.unwrap(verifiers)));
        if (precompileVerifier != address(0)) {
            success = verifySignatureAllowMalleability(IP256Verifier(precompileVerifier), message, r, s, x, y);
        }

        // If the precompile verification was not successful, fallback to a configured Solidity {IP256Verifier}
        // implementation. Note that this means that invalid signatures are potentially checked twice, once with the
        // precompile and once with the fallback verifier. This is intentional as there is no reliable way to
        // distinguish between the precompile being unavailable and the signature being invalid, as in both cases the
        // `STATICCALL` to the precompile contract will return empty bytes.
        if (!success && fallbackVerifier != address(0)) {
            success = verifySignatureAllowMalleability(IP256Verifier(fallbackVerifier), message, r, s, x, y);
        }
    }
}
