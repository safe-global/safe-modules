// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title SignatureValidatorConstants
 * @dev This contract defines the constants used for EIP-1271 signature validation.
 */
contract SignatureValidatorConstants {
    // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    bytes4 internal constant EIP1271_MAGIC_VALUE = 0x1626ba7e;

    // bytes4(keccak256("isValidSignature(bytes,bytes)")
    bytes4 internal constant LEGACY_EIP1271_MAGIC_VALUE = 0x20c13b0b;
}
