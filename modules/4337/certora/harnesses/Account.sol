// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import {Safe} from "@safe-global/safe-contracts/contracts/Safe.sol";

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

    /**
     * @dev This function encodes signature in a canonical format. This is required for formal verification.
     * The canonical format ensures the signatures are tightly packed one after the other in order.
     *
     * For more details on signature encoding: https://docs.safe.global/advanced/smart-account-signatures
     */
    function canonicalSignature(bytes calldata signatures, uint256 safeThreshold) public pure returns (bytes memory canonical) {
        uint256 dynamicOffset = safeThreshold * 0x41;
        bytes memory staticPart = signatures[:dynamicOffset];
        bytes memory dynamicPart = "";

        for (uint256 i = 0; i < safeThreshold; i++) {
            uint256 ptr = i * 0x41;
            uint8 v = uint8(signatures[ptr + 0x40]);

            // Check to see if we have a smart contract signature, and if we do, then append
            // the signature to the dynamic part.
            if (v == 0) {
                uint256 signatureOffset = uint256(bytes32(signatures[ptr + 0x20:]));

                uint256 signatureLength = uint256(bytes32(signatures[signatureOffset:]));
                bytes memory signature = signatures[signatureOffset + 0x20:][:signatureLength];

                // Make sure to update the static part so that the smart contract signature
                // points to the "canonical" signature offset (i.e. that all contract
                // signatures are tightly packed one after the other in order). This ensures
                // a canonical representation for the signatures.
                /* solhint-disable no-inline-assembly */
                assembly ("memory-safe") {
                    mstore(add(staticPart, add(0x40, ptr)), dynamicOffset)
                }
                /* solhint-enable no-inline-assembly */
                dynamicOffset += signatureLength + 0x20;
                dynamicPart = abi.encodePacked(dynamicPart, signatureLength, signature);
            }
        }
        canonical = abi.encodePacked(staticPart, dynamicPart);
    }
}

/*
 * @notice This is a harness contract for the rule that verfies the validation data
 *         in case the checkSignature functions reverts.
 */
contract AlwaysRevertingAccount {
    function checkSignatures(bytes32 dataHash, bytes memory data, bytes memory signatures) public pure {
        revert();
    }

    function getSignatures(bytes calldata signature) external pure returns (bytes memory slice) {
        slice = signature[12:];
    }
}
