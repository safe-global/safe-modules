// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {ERC1271} from "../libraries/ERC1271.sol";
/**
 * @title Signature Validator Base Contract
 * @dev A interface for smart contract Safe owners that supports multiple ERC-1271 `isValidSignature` versions.
 * @custom:security-contact bounty@safe.global
 */
abstract contract SignatureValidatorProxy {
    /**
     * @dev Validates the signature for the given data.
     * @param data The signed data bytes.
     * @param signature The signature to be validated.
     * @return magicValue The magic value indicating the validity of the signature.
     */
    function isValidSignature(bytes memory data, bytes calldata signature) external view returns (bytes4 magicValue) {
        uint256 x;
        uint256 y;
        address verifier;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            x := calldataload(sub(calldatasize(), 84))
            y := calldataload(sub(calldatasize(), 52))
            verifier := shr(96, calldataload(sub(calldatasize(), 20)))
        }
        if (_verifySignature(keccak256(data), signature, x, y, verifier)) {
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
        address verifier;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            x := calldataload(sub(calldatasize(), 84))
            y := calldataload(sub(calldatasize(), 52))
            verifier := shr(96, calldataload(sub(calldatasize(), 20)))
        }

        if (_verifySignature(message, signature, x, y, verifier)) {
            magicValue = ERC1271.MAGIC_VALUE;
        }
    }

    /**
     * @dev Verifies a signature.
     * @param message The signed message.
     * @param signature The signature to be validated.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @param verifier The address of the verifier contract.
     * @return success Whether the signature is valid.
     */
    function _verifySignature(
        bytes32 message,
        bytes calldata signature,
        uint256 x,
        uint256 y,
        address verifier
    ) internal view virtual returns (bool success);
}
