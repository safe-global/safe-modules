// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import {INonceManager} from "../interfaces/ERC4337.sol";
import {UserOperation, UserOperationLib} from "../UserOperation.sol";

interface Account {
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 requiredPrefund
    ) external returns (uint256);
}

contract TestEntryPoint is INonceManager {
    error NotEnoughFunds(uint256 expected, uint256 available);
    error InvalidNonce(uint256 userNonce);
    mapping(address => uint256) balances;
    mapping(address => mapping(uint192 => uint256)) public nonceSequenceNumber;

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

        if (!_validateAndUpdateNonce(userOp.sender, userOp.nonce)) {
            revert InvalidNonce(userOp.nonce);
        }

        require(gasleft() > userOp.callGasLimit, "Not enough gas for execution");
        userOp.sender.call{gas: userOp.callGasLimit}(userOp.callData);
    }

    function getNonce(address sender, uint192 key) external view override returns (uint256 nonce) {
        return nonceSequenceNumber[sender][key] | (uint256(key) << 64);
    }

    function incrementNonce(uint192 key) external override {
        nonceSequenceNumber[msg.sender][key]++;
    }

    function _validateAndUpdateNonce(address sender, uint256 nonce) internal returns (bool) {
        uint192 key = uint192(nonce >> 64);
        uint64 seq = uint64(nonce);
        return nonceSequenceNumber[sender][key]++ == seq;
    }
}
