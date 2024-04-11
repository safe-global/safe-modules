// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SignatureValidator} from "../base/SignatureValidator.sol";
import {P256, WebAuthn} from "../libraries/WebAuthn.sol";

/**
 * @title WebAuthn Singleton Signer
 * @dev A contract for verifying WebAuthn signatures for multiple accounts.
 */
contract TestWebAuthnSingletonSigner is SignatureValidator {
    /**
     * @notice Data associated with a WebAuthn signer. It represents the X and Y coordinates of the
     * signer's public key. This is stored in a mapping using the account address as the key.
     */
    struct OwnerData {
        uint256 x;
        uint256 y;
        P256.Verifiers verifiers;
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
        OwnerData memory owner = owners[msg.sender];

        isValid =
            P256.Verifiers.unwrap(owner.verifiers) != 0 &&
            WebAuthn.verifySignature(message, signature, WebAuthn.USER_VERIFICATION, owner.x, owner.y, owner.verifiers);
    }
}
