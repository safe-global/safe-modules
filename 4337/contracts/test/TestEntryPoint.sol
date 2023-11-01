// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;
import {INonceManager} from "@account-abstraction/contracts/interfaces/INonceManager.sol";
import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

/**
 * helper contract for EntryPoint, to call userOp.initCode from a "neutral" address,
 * which is explicitly not the entryPoint itself.
 */
contract SenderCreator {
    /**
     * call the "initCode" factory to create and return the sender account address
     * @param initCode the initCode value from a UserOp. contains 20 bytes of factory address, followed by calldata
     * @return sender the returned address of the created account, or zero address on failure.
     */
    function createSender(bytes calldata initCode) external returns (address sender) {
        address factory = address(bytes20(initCode[0:20]));
        bytes memory initCallData = initCode[20:];
        bool success;
        /* solhint-disable no-inline-assembly */
        assembly {
            success := call(gas(), factory, 0, add(initCallData, 0x20), mload(initCallData), 0, 32)
            sender := mload(0)
        }
        if (!success) {
            sender = address(0);
        }
    }
}

contract TestEntryPoint is INonceManager {
    error NotEnoughFunds(uint256 expected, uint256 available);
    error InvalidNonce(uint256 userNonce);
    event UserOpReverted(bytes reason);
    SenderCreator public immutable SENDER_CREATOR;
    mapping(address => uint256) public balances;
    mapping(address => mapping(uint192 => uint256)) public nonceSequenceNumber;

    constructor() {
        SENDER_CREATOR = new SenderCreator();
    }

    receive() external payable {
        balances[msg.sender] = balances[msg.sender] + msg.value;
    }

    function executeUserOp(UserOperation calldata userOp, uint256 requiredPrefund) external {
        if (userOp.sender.code.length == 0) {
            require(userOp.initCode.length >= 20, "Invalid initCode provided");
            require(userOp.sender == SENDER_CREATOR.createSender(userOp.initCode), "Could not create expected account");
        }

        require(gasleft() > userOp.verificationGasLimit, "Not enough gas for verification");

        uint256 userBalance = balances[userOp.sender];
        uint256 missingAccountFunds = requiredPrefund > userBalance ? requiredPrefund - userBalance : 0;

        uint256 validationResult = IAccount(userOp.sender).validateUserOp{gas: userOp.verificationGasLimit}(
            userOp,
            bytes32(0),
            missingAccountFunds
        );
        require(validationResult == 0, "Signature validation failed");

        userBalance = balances[userOp.sender];
        if (userBalance < requiredPrefund) {
            revert NotEnoughFunds(requiredPrefund, userBalance);
        }
        balances[userOp.sender] = userBalance - requiredPrefund;

        if (!_validateAndUpdateNonce(userOp.sender, userOp.nonce)) {
            revert InvalidNonce(userOp.nonce);
        }

        require(gasleft() > userOp.callGasLimit, "Not enough gas for execution");
        (bool success, bytes memory returnData) = userOp.sender.call{gas: userOp.callGasLimit}(userOp.callData);
        if (!success) {
            emit UserOpReverted(returnData);
        }
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
