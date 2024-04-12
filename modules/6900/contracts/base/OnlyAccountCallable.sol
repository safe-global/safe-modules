// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;

abstract contract OnlyAccountCallable {
    // Errors
    error InvalidSender(address sender);
    error InvalidCalldataLength();

    /**
     * @notice This modifier checks if caller is an account. This modifier is intended to be used
     *         with functions that update config related to an account e.g., enablePlugin(...).
     *         This modifier is required to ensure that calls for config changes for an account are not
     *         crafted ba a malicious address. For example, if this modifier is not used a malicious address
     *         can call enablePlugin(...) on an account having Manager as a fallback handler, and account will
     *         forward the call to the manager and cannot infer the call is not authoriyed by the account.
     */
    modifier onlyAccount() {
        checkOnlyAccount();
        _;
    }

    /**
     * @notice This function checks if the call to the contract is from an account by comparing
     *         the last 20 bytes of the calldata with the msg.sender.
     *         Based on https://eips.ethereum.org/EIPS/eip-2771.
     */
    function checkOnlyAccount() private view {
        // The check below ensures that the calldata has sender address appended additionally by the caller.
        if (msg.data.length < 20) {
            revert InvalidCalldataLength();
        }

        // Load last 20 bytes of calldata to load the sender of the message.
        address sender;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sender := shr(96, calldataload(sub(calldatasize(), 20)))
        }

        if (sender != msg.sender) {
            revert InvalidSender(sender);
        }
    }
}
