// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.24;

import {SignatureValidator} from "../base/SignatureValidator.sol";
import {ISafe} from "../interfaces/ISafe.sol";
import {P256, WebAuthn} from "../libraries/WebAuthn.sol";

/**
 * @title Safe WebAuthn Shared Signer
 * @dev A contract for verifying WebAuthn signatures shared by all Safe accounts. This contract uses
 * storage from the Safe account itself for full ERC-4337 compatibility.
 */
contract SafeWebAuthnSharedSigner is SignatureValidator {
    /**
     * @notice Data associated with a WebAuthn signer. It represents the X and Y coordinates of the
     * signer's public key as well as the P256 verifiers to use. This is stored in account storage
     * starting at the storage slot {SIGNER_SLOT}.
     */
    struct Signer {
        uint256 x;
        uint256 y;
        P256.Verifiers verifiers;
    }

    /**
     * @notice The storage slot of the mapping from shared WebAuthn signer address to signer data.
     * @custom:computed-as keccak256("SafeWebAuthnSharedSigner.signer") - 1
     * @dev This value is intentionally computed to be a hash -1 as a precaution to avoid any
     * potential issues from unintended hash collisions, and have enough space for all the signer
     * fields. Also, this is the slot of a `mapping(address self => Signer)` to ensure that multiple
     * {SafeWebAuthnSharedSigner} instances can coexist with the same account.
     */
    uint256 private constant _SIGNER_MAPPING_SLOT = 0x2e0aed53485dc2290ceb5ce14725558ad3e3a09d38c69042410ad15c2b4ea4e8;

    /**
     * @notice An error indicating a `CALL` to a function that should only be `DELEGATECALL`-ed.
     */
    error NotDelegateCalled();

    /**
     * @notice Address of the shared signer contract itself.
     * @dev This is used for determining whether or not the contract is being `DELEGATECALL`-ed when
     * setting signer data.
     */
    address private immutable _SELF;

    /**
     * @notice The starting storage slot on the account containing the signer data.
     */
    uint256 public immutable SIGNER_SLOT;

    /**
     * @notice Create a new shared WebAuthn signer instance.
     */
    constructor() {
        _SELF = address(this);
        SIGNER_SLOT = uint256(keccak256(abi.encode(address(this), _SIGNER_MAPPING_SLOT)));
    }

    /**
     * @notice Validates the call is done via `DELEGATECALL`.
     */
    modifier onlyDelegateCall() {
        if (address(this) == _SELF) {
            revert NotDelegateCalled();
        }
        _;
    }

    /**
     * @notice Return the signer configuration for the specified account.
     * @dev The calling account must be a Safe, as the signer data is stored in the Safe's storage
     * and must be read with the {StorageAccessible} support from the Safe.
     * @param account The account to request signer data for.
     */
    function getConfiguration(address account) public view returns (Signer memory signer) {
        bytes memory getStorageAtData = abi.encodeCall(ISafe(account).getStorageAt, (SIGNER_SLOT, 3));

        // Call the {StorageAccessible.getStorageAt} with assembly. This allows us to return a
        // zeroed out signer configuration instead of reverting for `account`s that are not Safes.
        // We also, expect the implementation to behave **exactly** like the Safe's - that is it
        // should encode the return data using a standard ABI encoding:
        // - The first 32 bytes is the offset of the values bytes array, always `0x20`
        // - The second 32 bytes is the length of the values bytes array, always `0x60`
        // - the following 3 words (96 bytes) are the values of the signer configuration.

        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            // Note that Yul expressions are evaluated in reverse order, so the `staticcall` is the
            // first thing to be evaluated in the nested `and` expression.
            if and(
                and(
                    // The offset of the ABI encoded bytes is 0x20, this should always be the case
                    // for standard ABI encoding of `(bytes)` tuple that `getStorageAt` returns.
                    eq(mload(0x00), 0x20),
                    // The length of the encoded bytes is exactly 0x60 bytes (i.e. 3 words, which is
                    // exactly how much we read from the Safe's storage in the `getStorageAt` call).
                    eq(mload(0x20), 0x60)
                ),
                and(
                    // The length of the return data should be exactly 0xa0 bytes, which should
                    // always be the case for the Safe's `getStorageAt` implementation.
                    eq(returndatasize(), 0xa0),
                    // The call succeeded. We write the first two words of the return data into the
                    // scratch space, as we need to inspect them before copying the signer
                    // signer configuration to our `signer` memory pointer.
                    staticcall(gas(), account, add(getStorageAtData, 0x20), mload(getStorageAtData), 0x00, 0x40)
                )
            ) {
                // Copy only the storage values from the return data to our `signer` memory address.
                // This only happens on success, so the `signer` value will be zeroed out if any of
                // the above conditions fail, indicating that no signer is configured.
                returndatacopy(signer, 0x40, 0x60)
            }
        }
    }

    /**
     * @notice Sets the signer configuration for the calling account.
     * @dev The Safe must call this function with a `DELEGATECALL`, as the signer data is stored in
     * the Safe account's storage.
     * @param signer The new signer data to set for the calling account.
     */
    function configure(Signer memory signer) external onlyDelegateCall {
        uint256 signerSlot = SIGNER_SLOT;
        Signer storage signerStorage;

        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            signerStorage.slot := signerSlot
        }

        signerStorage.x = signer.x;
        signerStorage.y = signer.y;
        signerStorage.verifiers = signer.verifiers;
    }

    /**
     * @inheritdoc SignatureValidator
     */
    function _verifySignature(bytes32 message, bytes calldata signature) internal view virtual override returns (bool isValid) {
        Signer memory signer = getConfiguration(msg.sender);

        // Make sure that the signer is configured in the first place.
        if (P256.Verifiers.unwrap(signer.verifiers) == 0) {
            return false;
        }

        isValid = WebAuthn.verifySignature(message, signature, WebAuthn.USER_VERIFICATION, signer.x, signer.y, signer.verifiers);
    }
}
