// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import "@safe-global/safe-contracts/contracts/Safe.sol";
contract ISafe is Safe {
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
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) public  {

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

    function getSignatureTimestamps(bytes calldata signature) external returns (uint96 slice) {
        slice = uint96(bytes12(signature[:12]));
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

    function getSignatureTimestampsFromValidationData(uint256 validationData) external pure returns (uint96) {
        return uint96(validationData >> 160);
    }
}