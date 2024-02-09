// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SignatureValidator} from "./SignatureValidator.sol";
import {IWebAuthnVerifier, WebAuthnConstants} from "./verifiers/WebAuthnVerifier.sol";

/**
 * @title WebAuthnSingletonSigner
 * @dev A contract for verifying WebAuthn signatures for multiple accounts.
 */
contract WebAuthnSingletonSigner is SignatureValidator {
    /**
     * @notice Internal structure used for decoding signature data components.
     */
    struct SignatureData {
        bytes authenticatorData;
        bytes clientDataFields;
        uint256[2] rs;
    }

    /**
     * @notice Data associated with a WebAuthn signer. It reprensents the X and Y coordinates of the signer's public
     * key. This is stored in a mapping using the account address as the key.
     */
    struct OwnerData {
        uint256 x;
        uint256 y;
        IWebAuthnVerifier verifier;
    }

    /**
     * @notice A mapping of account address to public keys of the owner.
     */
    mapping(address => OwnerData) private owners;

    /**
     * @notice Return the owner data for the specified account.
     * @param account The account to request owner data for.
     */
    function getOwner(address account) external view returns (OwnerData memory owner) {
        owner = owners[account];
    }

    /**
     * @notice Sets the owner data for the calling account.
     * @param owner The new owner data to set for the calling account.
     */
    function setOwner(OwnerData memory owner) external {
        owners[msg.sender] = owner;
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

        OwnerData memory owner = owners[msg.sender];

        isValid =
            owner.x != 0 &&
            owner.y != 0 &&
            owner.verifier.verifyWebAuthnSignatureAllowMalleability(
                signaturePointer.authenticatorData,
                WebAuthnConstants.AUTH_DATA_FLAGS_UV,
                message,
                signaturePointer.clientDataFields,
                signaturePointer.rs,
                owner.x,
                owner.y
            );
    }
}
