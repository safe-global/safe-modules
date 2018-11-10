pragma solidity 0.4.24;

import "ethereum-datetime/contracts/DateTime.sol";
import "gnosis-safe/contracts/base/ModuleManager.sol";
import "gnosis-safe/contracts/base/OwnerManager.sol";
import "gnosis-safe/contracts/base/Module.sol";
import "gnosis-safe/contracts/common/Enum.sol";
import "@gnosis.pm/dx-contracts/contracts/DutchExchange.sol";
import "@gnosis.pm/dx-contracts/contracts/Oracle/PriceOracleInterface.sol";

/// @title Recurring Transfer Module - Allows an owner to create transfers that can be executed by an owner or delegate on a recurring basis
/// @author Grant Wuerker - <gwuerker@gmail.com>
contract RecurringTransfersModule is Module {
    string public constant NAME = "Recurring Transfers Module";
    string public constant VERSION = "0.0.2";

    DateTime public dateTime;
    DutchExchange public dutchExchange;

    // recurringTransfers maps the composite hash of a token and account address to a recurring transfer struct.
    mapping (address => RecurringTransfer) public recurringTransfers;

    struct RecurringTransfer {
        address delegate;

        address token;
        address rate;
        uint256 amount;

        uint8 transferDay;
        uint8 transferHourStart;
        uint8 transferHourEnd;

        uint lastTransferTime;
    }

    /// @dev Setup function sets initial storage of contract.
    /// @param _dutchExchange Address of the DutchExchange contract.
    function setup(address _dutchExchange)
        public
    {
        require(address(_dutchExchange) != address(0));
        dutchExchange = DutchExchange(_dutchExchange);
        dateTime = new DateTime();
        setManager();
    }

    /// @dev Adds a recurring transfer struct to this module.
    /// @param receiver The address receiving the recurring transfer.
    /// @param delegate Address that can execute the recurring transfer in addition to owners (0 for none).
    /// @param token Address of the token that will be transfered (0 for Ether).
    /// @param rate Address of the token used to calculate the amount transfered (0 for none). For example, set this to DAI for consistent payment amounts in USD.
    /// @param amount The amount of tokens transfered. This will vary upon execution if a rate is provided.
    /// @param transferDay Day of the month when the recurring transfer can be executed (1-28).
    /// @param transferHourStart Time of the day when transfer can be executed (0-22).
    /// @param transferHourEnd Time of the day when transfer can no longer be executed (1-23).
    function addRecurringTransfer(
        address receiver,
        address delegate,
        address token,
        address rate,
        uint256 amount,
        uint8 transferDay,
        uint8 transferHourStart,
        uint8 transferHourEnd
    )
        public
    {
        require(OwnerManager(manager).isOwner(msg.sender), "Method can only be called by an owner");
        require(amount != 0, "amount must be greater than 0");
        require(transferDay < 29, "transferDay must be less than 29");
        require(transferHourStart > 0, "transferHourStart must be greater than 0");
        require(transferHourEnd < 23, "transferHourEnd must be less than 23");
        require(transferHourStart < transferHourEnd, "transferHourStart must be less than transferHourEnd");
        recurringTransfers[receiver] = RecurringTransfer(delegate, token, rate, amount, transferDay, transferHourStart, transferHourEnd, 0);
    }

    /// @dev Executes a recurring transfer.
    /// @param receiver The address that will receive tokens.
    function executeRecurringTransfer(address receiver)
        public
    {
        RecurringTransfer memory recurringTransfer = recurringTransfers[receiver];
        require(OwnerManager(manager).isOwner(msg.sender) || msg.sender == recurringTransfer.delegate, "Method can only be called by an owner or the external approver");
        require(isPastMonth(recurringTransfer.lastTransferTime), "Transfer has already been executed this month");
        require(isOnDayAndBetweenHours(recurringTransfer.transferDay, recurringTransfer.transferHourStart, recurringTransfer.transferHourEnd), "Transfer request not within valid timeframe");

        if (recurringTransfer.token == 0) {
            require(manager.execTransactionFromModule(receiver, recurringTransfer.amount, "", Enum.Operation.Call), "Could not execute ether transfer");
        } else {
            bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", receiver, recurringTransfer.amount);
            require(manager.execTransactionFromModule(recurringTransfer.token, 0, data, Enum.Operation.Call), "Could not execute token transfer");
        }

        recurringTransfers[receiver].lastTransferTime = now;
    }

    function isOnDayAndBetweenHours(uint8 day, uint8 hourStart, uint8 hourEnd)
        internal view returns (bool)
    {
        return dateTime.getDay(now) == day &&
        dateTime.getHour(now) > hourStart &&
        dateTime.getHour(now) < hourEnd;
    }

    function isPastMonth(uint previousTime)
        internal view returns (bool)
    {
        return dateTime.getYear(now) > dateTime.getYear(previousTime) ||
        dateTime.getMonth(now) > dateTime.getMonth(previousTime);
    }

    function getUSDETHPrice(address token)
        public view returns (uint, uint)
    {
        return dutchExchange.getPriceOfTokenInLastAuction(token);
    }
}
