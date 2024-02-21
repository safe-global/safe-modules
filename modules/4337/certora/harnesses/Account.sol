// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import {Safe} from "@safe-global/safe-contracts/contracts/Safe.sol";
import {Enum} from "@safe-global/safe-contracts/contracts/common/Enum.sol";

contract Account is Safe {
    constructor(
        address[] memory _owners,
        uint256 _threshold,
        address to,
        bytes memory data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) {
        setup2(_owners, _threshold, to, data, fallbackHandler, paymentToken, payment, paymentReceiver);
    }

    function setup2(
        address[] memory _owners,
        uint256 _threshold,
        address to,
        bytes memory data,
        address fallbackHandler,
        address,
        uint256,
        address payable
    ) public {
        // setupOwners checks if the Threshold is already set, therefore preventing that this method is called twice
        setupOwners(_owners, _threshold);
        if (fallbackHandler != address(0)) internalSetFallbackHandler(fallbackHandler);
        // As setupOwners can only be called if the contract has not been initialized we don't need a check for setupModules
        setupModules(to, data);

        // Skipped for now
        // if (payment > 0) {
        //     // To avoid running into issues with EIP-170 we reuse the handlePayment function (to avoid adjusting code of that has been verified we do not adjust the method itself)
        //     // baseGas = 0, gasPrice = 1 and gas = payment => amount = (payment + 0) * 1 = payment
        //     handlePayment(payment, 0, 1, paymentToken, paymentReceiver);
        // }
        emit SafeSetup(msg.sender, _owners, _threshold, to, fallbackHandler);
    }

    function getSignatures(bytes calldata signature) external returns (bytes memory slice) {
        slice = signature[12:];
    }

    function getValidAfterTimestamp(bytes calldata sigs) external pure returns (uint48) {
        return uint48(bytes6(sigs[:6]));
    }

    function getValidUntilTimestamp(bytes calldata sigs) external pure returns (uint48) {
        return uint48(bytes6(sigs[6:12]));
    }

    // CVL uses uint32 instead of bytes4 for the selector
    function getSelectorFromData(bytes calldata data) external pure returns (uint32) {
        return uint32(bytes4(data[:4]));
    }

    function getFallbackHandler() external view returns (address) {
        bytes32 slot = FALLBACK_HANDLER_STORAGE_SLOT;
        address handler;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            handler := sload(slot)
        }
        return handler;
    }

    function getNonceKey(uint256 nonce) external returns (uint192 key) {
        key = uint192(nonce >> 64);
    }
}

// @notice This is a harness contract for the rule that verfies the validation data
//         in case the checkSignature functions reverts.
contract AlwaysRevertingAccount {
    function checkSignatures(bytes32 dataHash, bytes memory data, bytes memory signatures) public view {
        revert();
    }

    function getSignatures(bytes calldata signature) external returns (bytes memory slice) {
        slice = signature[12:];
    }
}
