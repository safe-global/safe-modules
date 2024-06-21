// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

import {SafeWebAuthnSharedSigner} from "../4337/SafeWebAuthnSharedSigner.sol";

contract TestSharedWebAuthnSignerAccessor {
    function getSignerConfiguration(address sharedSigner) external view returns (SafeWebAuthnSharedSigner.Signer memory signer) {
        signer = _getSigners()[sharedSigner];
    }

    function _getSigners() private pure returns (mapping(address => SafeWebAuthnSharedSigner.Signer) storage signers) {
        uint256 signersSlot = uint256(keccak256("SafeWebAuthnSharedSigner.signer")) - 1;

        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            signers.slot := signersSlot
        }
    }
}
