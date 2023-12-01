// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import "./ISafe.sol";
contract ISafe3 is ISafe {
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
    ) ISafe(_owners, _threshold, to, data, fallbackHandler, paymentToken, payment, paymentReceiver) {
    }

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) public override returns (bool success) {
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