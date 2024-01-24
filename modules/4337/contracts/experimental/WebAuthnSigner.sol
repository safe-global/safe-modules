// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {IUniqueSignerFactory} from "./SafeSignerLaunchpad.sol";
import {SignatureValidatorConstants} from "./SignatureValidatorConstants.sol";
import {WebAuthn} from "./WebAuthn.sol";

struct SignatureData {
    bytes authenticatorData;
    bytes clientDataFields;
    uint256[2] rs;
}

function checkSignature(bytes memory data, bytes calldata signature, uint256 x, uint256 y) view returns (bool valid) {
    SignatureData calldata signaturePointer;
    // solhint-disable-next-line no-inline-assembly
    assembly ("memory-safe") {
        signaturePointer := signature.offset
    }

    return
        WebAuthn.checkSignature(
            signaturePointer.authenticatorData,
            0x01, // require user presence
            keccak256(data),
            signaturePointer.clientDataFields,
            signaturePointer.rs,
            x,
            y
        );
}

/**
 * @title WebAuthnSigner
 * @dev A contract that represents a WebAuthn signer.
 */
contract WebAuthnSigner is SignatureValidatorConstants {
    uint256 public immutable X;
    uint256 public immutable Y;

    /**
     * @dev Constructor function.
     * @param x The X coordinate of the signer's public key.
     * @param y The Y coordinate of the signer's public key.
     */
    constructor(uint256 x, uint256 y) {
        X = x;
        Y = y;
    }

    /**
     * @dev Validates the signature for the given data.
     * @param data The signed data bytes.
     * @param signature The signature to be validated.
     * @return magicValue The magic value indicating the validity of the signature.
     */
    function isValidSignature(bytes memory data, bytes calldata signature) external view returns (bytes4 magicValue) {
        if (checkSignature(data, signature, X, Y)) {
            magicValue = LEGACY_EIP1271_MAGIC_VALUE;
        }
    }

    /**
     * @dev Validates the signature for a given data hash.
     * @param dataHash The hash of the data to be validated.
     * @param signature The signature to be validated.
     * @return magicValue The magic value indicating the validity of the signature.
     */
    function isValidSignature(bytes32 dataHash, bytes calldata signature) external view returns (bytes4 magicValue) {
        if (checkSignature(abi.encode(dataHash), signature, X, Y)) {
            magicValue = EIP1271_MAGIC_VALUE;
        }
    }
}

/**
 * @title WebAuthnSignerFactory
 * @dev A factory contract for creating and managing WebAuthn signers.
 */
contract WebAuthnSignerFactory is IUniqueSignerFactory, SignatureValidatorConstants {
    /**
     * @dev Retrieves the signer address based on the provided data.
     * @param data Concatenated X and Y coordinates of the signer as bytes.
     * @return signer The address of the signer.
     */
    function getSigner(bytes calldata data) public view returns (address signer) {
        (uint256 x, uint256 y) = abi.decode(data, (uint256, uint256));
        signer = _getSigner(x, y);
    }

    /**
     * @dev Creates a new signer based on the provided data.
     * @param data Concatenated X and Y coordinates of the signer as bytes.
     * @return signer The address of the newly created signer.
     */
    function createSigner(bytes calldata data) external returns (address signer) {
        (uint256 x, uint256 y) = abi.decode(data, (uint256, uint256));
        signer = _getSigner(x, y);
        if (_hasNoCode(signer)) {
            WebAuthnSigner created = new WebAuthnSigner{salt: bytes32(0)}(x, y);
            require(address(created) == signer);
        }
    }

    /**
     * @dev Checks if the provided signature is valid for the given signer.
     * @param data The signed data as bytes.
     * @param signature The signature to be verified.
     * @param signerData The data used to identify the signer. In this case, the X and Y coordinates of the signer.
     * @return magicValue The magic value indicating the validity of the signature.
     */
    function isValidSignatureForSigner(
        bytes memory data,
        bytes calldata signature,
        bytes calldata signerData
    ) external view override returns (bytes4 magicValue) {
        (uint256 x, uint256 y) = abi.decode(signerData, (uint256, uint256));
        if (checkSignature(data, signature, x, y)) {
            magicValue = LEGACY_EIP1271_MAGIC_VALUE;
        }
    }

    /**
     * @dev Retrieves the signer address based on the provided coordinates.
     * @param x The x-coordinate of the signer.
     * @param y The y-coordinate of the signer.
     * @return The address of the signer.
     */
    function _getSigner(uint256 x, uint256 y) internal view returns (address) {
        bytes32 codeHash = keccak256(abi.encodePacked(type(WebAuthnSigner).creationCode, x, y));
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)))));
    }

    /**
     * @dev Checks if the provided account has no code.
     * @param account The address of the account to check.
     * @return True if the account has no code, false otherwise.
     */
    function _hasNoCode(address account) internal view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            size := extcodesize(account)
        }
        return size == 0;
    }
}
