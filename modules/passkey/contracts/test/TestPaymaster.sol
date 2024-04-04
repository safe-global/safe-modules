// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/**
 * @title A TestPaymaster contract that will be used to pay the cost for executing UserOps
 * TODO: This is a dummy contract that has no validation logic. Either implement validation logic or remove this contract and use MockContract.
 */
contract TestPaymaster {
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        context = "";
        validationData = 0;
    }

    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost, uint256 actualUserOpFeePerGas) external {}

    enum PostOpMode {
        opSucceeded, // user op succeeded
        opReverted, // user op reverted. still has to pay for gas.
        postOpReverted // Regardless of the UserOp call status, the postOp reverted, and caused both executions to revert.
    }

    function stakeEntryPoint(IEntryPoint entryPoint, uint32 unstakeDelaySecs) external payable {
        entryPoint.addStake{value: msg.value}(unstakeDelaySecs);
    }

    function depositTo(IEntryPoint entryPoint) external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }
}
