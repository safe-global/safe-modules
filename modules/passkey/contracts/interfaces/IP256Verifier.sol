// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable payable-fallback */
pragma solidity ^0.8.20;

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
     * The output is either:
     * - `abi.encode(1)` bytes for a valid signature.
     * - `""` empty bytes for an invalid signature or error.
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
