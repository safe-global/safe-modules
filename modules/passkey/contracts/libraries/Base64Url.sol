// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

/**
 * @title Base64Url Encoding Library
 * @dev Provides a function to encode `bytes32` data into a Base64 URL string representation without '=' padding.
 * @notice This library is adapted from solady's Base64 library and optimized for bytes32 encoding, which is useful for
 *         WebAuthn-based cryptographic operations.
 * @author Modified from Solady (https://github.com/Vectorized/solady/blob/e4a14a5b365b353352f7c38e699a2bc9363d6576/src/utils/Base64.sol)
 */
library Base64Url {
    /**
     * @dev Encodes `bytes32` data into a Base64 URL string without '=' padding.
     * @param data The `bytes32` input data to be encoded.
     * @return result The encoded string in Base64 URL format.
     */
    function encode(bytes32 data) internal pure returns (string memory result) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            // The length of the encoded string (43 characters for bytes32 input).
            // (32 bytes * 8 bits) / 6 bits base64 groups = 43 characters rounded.
            let encodedLength := 43

            // Set `result` to point to the start of the free memory.
            // This is where the encoded string will be stored.
            result := mload(0x40)

            // Store the Base64 URL character table into the scratch space.
            // The table is split into two parts and stored at memory locations 0x1f and 0x3f.
            // Offsetted by -1 byte so that the `mload` will load the correct character.
            // We will rewrite the free memory pointer at `0x40` later with the allocated size.
            mstore(0x1f, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef")
            mstore(0x3f, "ghijklmnopqrstuvwxyz0123456789-_")

            // Initialize pointers for writing the encoded data.
            // `ptr` points to the start of the encoded string (skipping the first slot that stores the length).
            // `end` points to the end of the encoded string.
            let ptr := add(result, 0x20)
            let end := add(ptr, encodedLength)

            // To minimize stack operations, we unroll the loop.
            // With full 6 iterations of the loop, we need to encode seven 6-bit groups and one 4-bit group.
            // In total, it encodes 6 iterations * 7 groups * 6 bits = 252 bits.
            // The remaining 4-bit group is encoded after the loop.
            // `i` is initialized to 250, which is the number of bits by which we need to shift the data
            // to get the first 6-bit group, and then we subtract 6 to get the next 6-bit group.
            let i := 250
            for {

            } 1 {

            } {
                // Encode 6-bit groups into characters by looking them up in the character table.
                // The encoded characters are written to the scratch space at memory locations 0 to 6.
                // 0x3F is a mask to get the last 6 bits.
                mstore8(0, mload(and(shr(i, data), 0x3F)))
                mstore8(1, mload(and(shr(sub(i, 6), data), 0x3F)))
                mstore8(2, mload(and(shr(sub(i, 12), data), 0x3F)))
                mstore8(3, mload(and(shr(sub(i, 18), data), 0x3F)))
                mstore8(4, mload(and(shr(sub(i, 24), data), 0x3F)))
                mstore8(5, mload(and(shr(sub(i, 30), data), 0x3F)))
                mstore8(6, mload(and(shr(sub(i, 36), data), 0x3F)))

                // Write the encoded characters to the result string.
                // The characters are loaded from memory locations 0 to 6 and stored at `ptr`.
                mstore(ptr, mload(0x00))
                // Advance the pointer by the number of bytes written (7 bytes in this case).
                ptr := add(ptr, 0x7)
                // Move the data pointer to the next 6-bit group.
                // 42 = 6 bits * 7 (number of groups processed in each iteration).
                i := sub(i, 42)

                // Break the loop when the end of the encoded string is reached.
                if iszero(sgt(i, 0)) {
                    break
                }
            }

            // Encode the final 4-bit group.
            // 0x0F is a mask to get the last 4 bits.
            // The encoded character is stored at memory location 74 (result + 74):
            // <32byte string length><43byte encoded string>. 74 is the penultimate byte.
            mstore8(add(result, 74), mload(shl(2, and(data, 0x0F))))

            // Update the free memory pointer to point to the end of the encoded string.
            // Store the length of the encoded string at the beginning of `result`.
            mstore(0x40, end)
            mstore(result, encodedLength)
        }
    }
}
