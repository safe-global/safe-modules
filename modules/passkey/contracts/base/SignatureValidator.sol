// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {ERC1271} from "../libraries/ERC1271.sol";
import {P256} from "../libraries/WebAuthn.sol";

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
        uint256 x;
        uint256 y;
        P256.Verifiers verifiers;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            x := calldataload(sub(calldatasize(), 88))
            y := calldataload(sub(calldatasize(), 56))
            verifiers := shr(64, calldataload(sub(calldatasize(), 24)))
        }
        if (_verifySignature(keccak256(data), signature, x, y, verifiers)) {
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
        uint256 x;
        uint256 y;
        P256.Verifiers verifiers;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            x := calldataload(sub(calldatasize(), 88))
            y := calldataload(sub(calldatasize(), 56))
            verifiers := shr(64, calldataload(sub(calldatasize(), 24)))
        }

        if (_verifySignature(message, signature, x, y, verifiers)) {
            magicValue = ERC1271.MAGIC_VALUE;
        }
    }

    /**
     * @dev Verifies a signature.
     * @param message The signed message.
     * @param signature The signature to be validated.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @param verifiers The address of the verifier contract and the fallback address.
     * @return success Whether the signature is valid.
     */
    function _verifySignature(
        bytes32 message,
        bytes calldata signature,
        uint256 x,
        uint256 y,
        P256.Verifiers verifiers
    ) internal view virtual returns (bool success);
}
