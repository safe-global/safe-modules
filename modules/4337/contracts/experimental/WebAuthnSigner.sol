// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {SignatureValidatorConstants} from "./SignatureValidatorConstants.sol";
import {IUniqueSignerFactory} from "./SafeSignerLaunchpad.sol";
import {SignatureValidatorConstants} from "./SignatureValidatorConstants.sol";
import {WebAuthnVerifier} from "./WebAuthnVerifier.sol";

struct SignatureData {
    bytes authenticatorData;
    bytes clientDataFields;
    uint256[2] rs;
}

/**
 * @title WebAuthnSigner
 * @dev A contract that represents a WebAuthn signer.
 */
contract WebAuthnSigner is SignatureValidatorConstants, WebAuthnVerifier {
    uint256 public immutable X;
    uint256 public immutable Y;

    /**
     * @dev Constructor function.
     * @param x The X coordinate of the signer's public key.
     * @param y The Y coordinate of the signer's public key.
     * @param p256Verifier The address of the P256Verifier contract.
     */
    constructor(uint256 x, uint256 y, address p256Verifier) WebAuthnVerifier(p256Verifier) {
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
        if (checkSignature(keccak256(data), signature)) {
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
        if (checkSignature(dataHash, signature)) {
            magicValue = EIP1271_MAGIC_VALUE;
        }
    }

    /**
     * @dev Checks the validity of a signature for a given data hash.
     * @param dataHash The hash of the data to be verified.
     * @param signature The signature to be checked.
     * @return A boolean indicating whether the signature is valid or not.
     */
    function checkSignature(bytes32 dataHash, bytes calldata signature) internal view returns (bool) {
        SignatureData calldata signaturePointer;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            signaturePointer := signature.offset
        }

        return
            WebAuthnVerifier.checkSignature(
                signaturePointer.authenticatorData,
                WebAuthnVerifier.AUTH_DATA_FLAGS_UV,
                dataHash,
                signaturePointer.clientDataFields,
                signaturePointer.rs,
                X,
                Y
            );
    }
}

/**
 * @title WebAuthnSignerFactory
 * @dev A factory contract for creating and managing WebAuthn signers.
 */
contract WebAuthnSignerFactory is IUniqueSignerFactory, SignatureValidatorConstants, WebAuthnVerifier {
    /**
     * @dev Constructor function.
     * @param p256Verifier The address of the P256Verifier contract.
     */
    constructor(address p256Verifier) WebAuthnVerifier(p256Verifier) {}

    /**
     * @dev Retrieves the signer address based on the provided data.
     * @param data Concatenated X and Y coordinates of the signer as bytes.
     * @return signer The address of the signer.
     */
    function getSigner(bytes calldata data) public view returns (address signer) {
        (uint256 x, uint256 y, address verifier) = abi.decode(data, (uint256, uint256, address));
        signer = _getSigner(x, y, verifier);
    }

    /**
     * @dev Creates a new signer based on the provided data.
     * @param data Concatenated X and Y coordinates of the signer as bytes.
     * @return signer The address of the newly created signer.
     */
    function createSigner(bytes calldata data) external returns (address signer) {
        (uint256 x, uint256 y, address verifier) = abi.decode(data, (uint256, uint256, address));
        signer = _getSigner(x, y, verifier);

        if (_hasNoCode(signer) && _validVerifier(verifier)) {
            WebAuthnSigner created = new WebAuthnSigner{salt: bytes32(0)}(x, y, verifier);
            require(address(created) == signer);
        }
    }

    function _validVerifier(address verifier) internal view returns (bool) {
        // The verifier should either contain code or be the precompile
        return !_hasNoCode(verifier) || verifier == address(0x0b);
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
        if (checkSignature(keccak256(data), signature, x, y)) {
            magicValue = LEGACY_EIP1271_MAGIC_VALUE;
        }
    }

    /**
     * @dev Retrieves the signer address based on the provided coordinates.
     * @param x The x-coordinate of the signer.
     * @param y The y-coordinate of the signer.
     * @return The address of the signer.
     */
    function _getSigner(uint256 x, uint256 y, address verifier) internal view returns (address) {
        bytes32 codeHash = keccak256(abi.encodePacked(type(WebAuthnSigner).creationCode, x, y, uint256(uint160(verifier))));
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

    /**
     * @dev Checks the validity of a signature using WebAuthnVerifier.
     * @param dataHash The hash of the data being signed.
     * @param signature The signature to be verified.
     * @param x The x-coordinate of the public key.
     * @param y The y-coordinate of the public key.
     * @return A boolean indicating whether the signature is valid or not.
     */
    function checkSignature(bytes32 dataHash, bytes calldata signature, uint256 x, uint256 y) internal view returns (bool) {
        SignatureData calldata signaturePointer;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            signaturePointer := signature.offset
        }

        return
            WebAuthnVerifier.checkSignature(
                signaturePointer.authenticatorData,
                WebAuthnVerifier.AUTH_DATA_FLAGS_UV,
                dataHash,
                signaturePointer.clientDataFields,
                signaturePointer.rs,
                x,
                y
            );
    }
}
