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
}

contract Account2 is Account {
    bool public execTransactionFromModuleCalled = false;

    constructor(
        address[] memory _owners,
        uint256 _threshold,
        address to,
        bytes memory data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) Account(_owners, _threshold, to, data, fallbackHandler, paymentToken, payment, paymentReceiver) {}

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) public override returns (bool success) {
        execTransactionFromModuleCalled = true;
        super.execTransactionFromModule(to, value, data, operation);
    }
}

contract Account4 {
    function checkSignatures(bytes32 dataHash, bytes memory data, bytes memory signatures) public view {
        revert();
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
}

contract Account3 is Account {
    bool public execTransactionFromModuleCalled = false;

    constructor(
        address[] memory _owners,
        uint256 _threshold,
        address to,
        bytes memory data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) Account(_owners, _threshold, to, data, fallbackHandler, paymentToken, payment, paymentReceiver) {}

    function execTransactionFromModule(address to, uint256 value, bytes memory, Enum.Operation) public override returns (bool success) {
        execTransactionFromModuleCalled = true;
        // Required here to avoid DEFAULT HAVOC
        transferEth(to, value);
    }

    function transferEth(address to, uint256 value) public {
        payable(to).transfer(value);
    }

    function getNativeTokenBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getNativeTokenBalanceFor(address addr) public view returns (uint256) {
        return addr.balance;
    }
}
