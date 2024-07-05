// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import {ERC1271} from "../libraries/ERC1271.sol";

/**
 * @title Signature Validator Base Contract
 * @dev A interface for smart contract Safe owners that supports multiple ERC-1271 `isValidSignature` versions.
 * @custom:security-contact bounty@safe.global
 */
abstract contract SignatureValidator {
    /**
     * @dev Validates the signature for the given data.
     * @param data The signed data bytes.
     * @param signature The signature to be validated.
     * @return magicValue The magic value indicating the validity of the signature.
     */
    function isValidSignature(bytes memory data, bytes calldata signature) external view returns (bytes4 magicValue) {
        if (_verifySignature(keccak256(data), signature)) {
            magicValue = ERC1271.LEGACY_MAGIC_VALUE;
        }
    }

    /**
     * @dev Validates the signature for a given data hash.
     * @param message The signed message.
     * @param signature The signature to be validated.
     * @return magicValue The magic value indicating the validity of the signature.
     */
    function isValidSignature(bytes32 message, bytes calldata signature) external view returns (bytes4 magicValue) {
        if (_verifySignature(message, signature)) {
            magicValue = ERC1271.MAGIC_VALUE;
        }
    }

    /**
     * @dev Verifies a signature.
     * @param message The signed message.
     * @param signature The signature to be validated.
     * @return success Whether the signature is valid.
     */
    function _verifySignature(bytes32 message, bytes calldata signature) internal view virtual returns (bool success);
}
