// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

/**
 * @title Safe Smart Account
 * @dev Minimal interface of a Safe smart account. This only includes functions that are used by
 * this project.
 * @custom:security-contact bounty@safe.global
 */
interface ISafe {
    /**
     * @notice Sets an initial storage of the Safe contract.
     * @dev This method can only be called once. If a proxy was created without setting up, anyone
     * can call setup and claim the proxy.
     * @param owners List of Safe owners.
     * @param threshold Number of required confirmations for a Safe transaction.
     * @param to Contract address for optional delegate call.
     * @param data Data payload for optional delegate call.
     * @param fallbackHandler Handler for fallback calls to this contract
     * @param paymentToken Token that should be used for the payment (0 is ETH)
     * @param payment Value that should be paid
     * @param paymentReceiver Address that should receive the payment (or 0 if tx.origin)
     */
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;

    /**
     * @notice Reads `length` bytes of storage in the currents contract
     * @param offset - the offset in the current contract's storage in words to start reading from
     * @param length - the number of words (32 bytes) of data to read
     * @return the bytes that were read.
     */
    function getStorageAt(uint256 offset, uint256 length) external view returns (bytes memory);
}
