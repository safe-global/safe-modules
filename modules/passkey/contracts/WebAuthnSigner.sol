// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {SignatureValidatorConstants} from "./SignatureValidatorConstants.sol";
import {ICustom256BitECSignerFactory} from "./interfaces/ICustomSignerFactory.sol";
import {SignatureValidator} from "./SignatureValidator.sol";
import {IWebAuthnVerifier, WebAuthnConstants} from "./verifiers/WebAuthnVerifier.sol";

struct SignatureData {
    bytes authenticatorData;
    bytes clientDataFields;
    uint256[2] rs;
}

/**
 * @title WebAuthnSigner
 * @dev A contract that represents a WebAuthn signer.
 */
contract WebAuthnSigner is SignatureValidator {
    uint256 public immutable X;
    uint256 public immutable Y;
    IWebAuthnVerifier public immutable WEBAUTHN_SIG_VERIFIER;

    /**
     * @dev Constructor function.
     * @param qx The X coordinate of the signer's public key.
     * @param qy The Y coordinate of the signer's public key.
     * @param webAuthnVerifier The address of the P256Verifier contract.
     */
    constructor(uint256 qx, uint256 qy, address webAuthnVerifier) {
        X = qx;
        Y = qy;
        WEBAUTHN_SIG_VERIFIER = IWebAuthnVerifier(webAuthnVerifier);
    }

    /**
     * @inheritdoc SignatureValidator
     */
    function _verifySignature(bytes32 message, bytes calldata signature) internal view virtual override returns (bool isValid) {
        SignatureData calldata signaturePointer;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            signaturePointer := signature.offset
        }

        return
            WEBAUTHN_SIG_VERIFIER.verifyWebAuthnSignatureAllowMalleability(
                signaturePointer.authenticatorData,
                WebAuthnConstants.AUTH_DATA_FLAGS_UV,
                message,
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
contract WebAuthnSignerFactory is ICustom256BitECSignerFactory, SignatureValidatorConstants {
    // @inheritdoc ICustom256BitECSignerFactory
    function getSigner(uint256 qx, uint256 qy, address verifier) public view override returns (address signer) {
        bytes32 codeHash = keccak256(abi.encodePacked(type(WebAuthnSigner).creationCode, qx, qy, uint256(uint160(verifier))));
        signer = address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)))));
    }

    // @inheritdoc ICustom256BitECSignerFactory
    function createSigner(uint256 qx, uint256 qy, address verifier) external returns (address signer) {
        signer = getSigner(qx, qy, verifier);

        if (_hasNoCode(signer) && _validVerifier(verifier)) {
            WebAuthnSigner created = new WebAuthnSigner{salt: bytes32(0)}(qx, qy, verifier);
            require(address(created) == signer);
        }
    }

    /**
     * @dev Checks if the given verifier address contains code.
     * @param verifier The address of the verifier to check.
     * @return A boolean indicating whether the verifier contains code or not.
     */
    function _validVerifier(address verifier) internal view returns (bool) {
        // The verifier should contain code (The only way to implement a webauthn verifier is with a smart contract)
        return !_hasNoCode(verifier);
    }

    // @inheritdoc ICustom256BitECSignerFactory
    function isValidSignatureForSigner(
        uint256 qx,
        uint256 qy,
        address verifier,
        bytes32 message,
        bytes calldata signature
    ) external view override returns (bytes4 magicValue) {
        if (checkSignature(verifier, message, signature, qx, qy)) {
            magicValue = EIP1271_MAGIC_VALUE;
        }
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
     * @param verifier The address of the WebAuthnVerifier contract.
     * @param dataHash The hash of the data being signed.
     * @param signature The signature to be verified.
     * @param qx The x-coordinate of the public key.
     * @param qy The y-coordinate of the public key.
     * @return A boolean indicating whether the signature is valid or not.
     */
    function checkSignature(
        address verifier,
        bytes32 dataHash,
        bytes calldata signature,
        uint256 qx,
        uint256 qy
    ) internal view returns (bool) {
        SignatureData calldata signaturePointer;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            signaturePointer := signature.offset
        }

        return
            IWebAuthnVerifier(verifier).verifyWebAuthnSignatureAllowMalleability(
                signaturePointer.authenticatorData,
                WebAuthnConstants.AUTH_DATA_FLAGS_UV,
                dataHash,
                signaturePointer.clientDataFields,
                signaturePointer.rs,
                qx,
                qy
            );
    }
}
