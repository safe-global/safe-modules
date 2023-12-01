// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import {Account} from "./Account.sol";
import {Enum} from "@safe-global/safe-contracts/contracts/common/Enum.sol";

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
    ) Account(_owners, _threshold, to, data, fallbackHandler, paymentToken, payment, paymentReceiver) {
    }

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory,
        Enum.Operation
    ) public override returns (bool success)  {
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
