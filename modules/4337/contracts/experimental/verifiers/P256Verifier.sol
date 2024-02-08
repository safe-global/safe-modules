// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {FCL_ecdsa} from "../../vendor/FCL/FCL_ecdsa.sol";

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

        return abi.encode(FCL_ecdsa.ecdsa_verify(hash, r, s, x, y));
    }
}
