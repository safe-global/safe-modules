// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

/**
 * @title ERC-1271 Magic Values
 * @dev Library that defines constants for ERC-1271 related magic values.
 * @custom:security-contact bounty@safe.global
 */
library ERC1271 {
    /**
     * @notice ERC-1271 magic value returned on valid signatures.
     * @dev Value is derived from `bytes4(keccak256("isValidSignature(bytes32,bytes)")`.
     */
    bytes4 internal constant MAGIC_VALUE = 0x1626ba7e;

    /**
     * @notice Legacy EIP-1271 magic value returned on valid signatures.
     * @dev This value was used in previous drafts of the EIP-1271 standard, but replaced by
     * {MAGIC_VALUE} in the final version.
     *
     * Value is derived from `bytes4(keccak256("isValidSignature(bytes,bytes)")`.
     */
    bytes4 internal constant LEGACY_MAGIC_VALUE = 0x20c13b0b;
}
