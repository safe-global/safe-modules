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

    /*
    Actual Signature:
    "0x" +
    "0000000000000000000000000000000000000000000000000000000000000001 00000000000000000000000000000000000000000000000000000000000000c3 00" +     // encoded EIP-1271 signature 1
    "0000000000000000000000000000000000000000000000000000000000000002 0000000000000000000000000000000000000000000000000000000000000103 00" +     // encoded EIP-1271 signature 2
    "0000000000000000000000000000000000000000000000000000000000000003 0000000000000000000000000000000000000000000000000000000000000147 00" +     // encoded EIP-1271 signature 3
    "0000000000000000000000000000000000000000000000000000000000000004 00000000000000000000000000000000000000000000000000000000deadbeef"          // length of bytes + data of bytes of signature 1
    "0000000000000000000000000000000000000000000000000000000000000024 deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"  // length of bytes + data of bytes of signature 2
    "0000000000000000000000000000000000000000000000000000000000000003 0000000000000000000000000000000000000000000000000000000000efbeef"          // length of bytes + data of bytes of signature 3

    0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000c30000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000103000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000014700000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000deadbeef0000000000000000000000000000000000000000000000000000000000000024deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000efbeef

    With Excess Data Type 1:
    "0x" +
    "0000000000000000000000000000000000000000000000000000000000000001 00000000000000000000000000000000000000000000000000000000000000c3 00" +                    // encoded EIP-1271 signature 1
    "0000000000000000000000000000000000000000000000000000000000000002 0000000000000000000000000000000000000000000000000000000000000103 00" +                    // encoded EIP-1271 signature 2
    "0000000000000000000000000000000000000000000000000000000000000003 0000000000000000000000000000000000000000000000000000000000000147 00" +                    // encoded EIP-1271 signature 3
    "0000000000000000000000000000000000000000000000000000000000000008 00000000000000000000000000000000000000000000000000000000deadbeef"                         // length of bytes + data of bytes of signature 1
    "0000000000000000000000000000000000000000000000000000000000000024 deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"                 // length of bytes + data of bytes of signature 2
    "0000000000000000000000000000000000000000000000000000000000000003 0000000000000000000000000000000000000000000000000000000000efbeefdeadbeefdeadbeefdeadbeef" // length of bytes + data of bytes of signature 3 + excess data

    0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000c30000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000103000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000014700000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000deadbeef0000000000000000000000000000000000000000000000000000000000000024deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000efbeefdeadbeefdeadbeefdeadbeef

    With Excess Data Type 2:
    "0x" +
    "0000000000000000000000000000000000000000000000000000000000000001 00000000000000000000000000000000000000000000000000000000000000c3 00" +     // encoded EIP-1271 signature 1
    "0000000000000000000000000000000000000000000000000000000000000002 0000000000000000000000000000000000000000000000000000000000000107 00" +     // encoded EIP-1271 signature 2
    "0000000000000000000000000000000000000000000000000000000000000003 000000000000000000000000000000000000000000000000000000000000014b 00" +     // encoded EIP-1271 signature 3
    "0000000000000000000000000000000000000000000000000000000000000008 00000000000000000000000000000000000000000000000000000000deadbeefdeadbeef"  // length of bytes + data of bytes of signature 1 + excess data
    "0000000000000000000000000000000000000000000000000000000000000024 deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"  // length of bytes + data of bytes of signature 2
    "0000000000000000000000000000000000000000000000000000000000000003 0000000000000000000000000000000000000000000000000000000000efbeef"          // length of bytes + data of bytes of signature 3

    0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000c30000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000107000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000014b00000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000deadbeefdeadbeef0000000000000000000000000000000000000000000000000000000000000024deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000efbeef

    All three will have the same canonical hash: 0xe304234a47e4f89d0a95d9fafb42e9c3143e23e951d38add9f781c34f962deb7
    */
    function canonicalSignatureHash(bytes calldata signatures, uint256 safeThreshold) public pure returns (bytes32 canonical) {
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
                require(signatureOffset >= dynamicOffset, "Invalid signature offset");

                uint256 signatureLength = uint256(bytes32(signatures[signatureOffset:]));
                require(signatureLength > 0, "Invalid signature length");

                bytes memory signature;
                if (signatureLength < 0x20) {
                    signature = signatures[signatureOffset+0x40-signatureLength:][:signatureLength];
                }
                else {
                    signature = signatures[signatureOffset+0x20:][:signatureLength];
                }

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
        canonical = keccak256(abi.encodePacked(staticPart, dynamicPart));
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
