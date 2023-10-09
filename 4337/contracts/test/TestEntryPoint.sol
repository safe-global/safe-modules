// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import "../UserOperation.sol";

interface Account {
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 requiredPrefund
    ) external returns (uint256);
}

contract TestEntryPoint {
    error NotEnoughFunds(uint256 expected, uint256 available);
    mapping(address => uint256) balances;

    receive() external payable {
        balances[msg.sender] = balances[msg.sender] + msg.value;
    }

    function executeUserOp(UserOperation calldata userOp, uint256 requiredPrefund) external {
        require(gasleft() > userOp.verificationGasLimit, "Not enough gas for verification");
        Account(userOp.sender).validateUserOp{gas: userOp.verificationGasLimit}(userOp, bytes32(0), requiredPrefund);
        uint256 userBalance = balances[userOp.sender];
        if (userBalance < requiredPrefund) {
            revert NotEnoughFunds(requiredPrefund, userBalance);
        }
        balances[userOp.sender] = userBalance - requiredPrefund;
        require(gasleft() > userOp.callGasLimit, "Not enough gas for execution");
        userOp.sender.call{gas: userOp.callGasLimit}(userOp.callData);
    }
}
