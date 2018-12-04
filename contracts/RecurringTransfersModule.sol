pragma solidity 0.4.24;

import "ethereum-datetime/contracts/DateTime.sol";
import "gnosis-safe/contracts/base/ModuleManager.sol";
import "gnosis-safe/contracts/base/OwnerManager.sol";
import "gnosis-safe/contracts/base/Module.sol";
import "gnosis-safe/contracts/common/SecuredTokenTransfer.sol";
import "gnosis-safe/contracts/common/Enum.sol";
import "gnosis-safe/contracts/common/SignatureDecoder.sol";
import "@gnosis.pm/dx-contracts/contracts/DutchExchange.sol";

/// @title Recurring Transfer Module - Allows an owner to create transfers that can be executed by an owner or delegate on a recurring basis
/// @author Grant Wuerker - <gwuerker@gmail.com>
contract RecurringTransfersModule is Module, SecuredTokenTransfer, SignatureDecoder {
    string public constant NAME = "Recurring Transfers Module";
    string public constant VERSION = "0.1.0";

    DateTime public dateTime;
    DutchExchange public dutchExchange;

    // recurringTransfers maps the composite hash of a token and account address to a recurring transfer struct.
    mapping (address => RecurringTransfer) public recurringTransfers;

    // gasPriceLimits maps a token address to a gas price limit for transfer refunds
    mapping (address => uint256) public gasPriceLimits;

    // dataGasLimits maps a token address to a data gas limit for transfer refunds
    mapping (address => uint256) public dataGasLimits;

    // nonce to invalidate previously executed transactions
    uint256 public nonce;

    struct RecurringTransfer {
        address delegate;

        address token;
        address rateToken;
        uint256 amount;

        uint8 transferDay;
        uint8 transferHourStart;
        uint8 transferHourEnd;

        uint256 lastTransferTime;
    }

    /// @dev Setup function sets initial storage of contract.
    /// @param _dutchExchange Address of the DutchExchange contract.
    /// @param _dateTime Address of the DateTime contract.
    function setup(address _dutchExchange, address _dateTime)
        public
    {
        require(_dutchExchange != 0, "A non-zero dutch exchange address must be provided.");
        require(_dateTime != 0, "A non-zero date time address must be provided.");
        dutchExchange = DutchExchange(_dutchExchange);
        dateTime = DateTime(_dateTime);
        setManager();
    }

    /// @dev Creates a recurring transfer.
    /// @param receiver The address receiving the recurring transfer.
    /// @param delegate Address that can execute the recurring transfer in addition to owners (0 for none).
    /// @param token Address of the token that will be transfered (0 for Ether).
    /// @param rateToken Address of the token used to calculate the amount transfered (0 for none). For example, set this to DAI for consistent payment amounts in USD.
    /// @param amount The amount of tokens transfered. This will vary upon execution if a rateToken is provided.
    /// @param transferDay Day of the month when the recurring transfer can be executed (1-28).
    /// @param transferHourStart Time of the day when transfer can be executed (0-22).
    /// @param transferHourEnd Time of the day when transfer can no longer be executed (1-23).
    function addRecurringTransfer(
        address receiver,
        address delegate,
        address token,
        address rateToken,
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
        recurringTransfers[receiver] = RecurringTransfer(delegate, token, rateToken, amount, transferDay, transferHourStart, transferHourEnd, 0);
    }

    /// @dev Removes a recurring transfer.
    /// @param receiver The receiving address for the recurring transfer.
    function removeRecurringTransfer(address receiver) public {
        require(OwnerManager(manager).isOwner(msg.sender), "Method can only be called by an owner");
        delete recurringTransfers[receiver];
    }

    /// @dev Executes a recurring transfer.
    /// @param receiver The address that will receive tokens.
    /// @param safeTxGas Gas that should be used for the Safe transaction.
    /// @param dataGas Gas costs for data used to trigger the safe transaction and to pay the payment transfer
    /// @param gasPrice Gas price that should be used for the payment calculation.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    function executeRecurringTransfer(
        address receiver,
        uint256 safeTxGas,
        uint256 dataGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        bytes signatures
    )
        public
    {
        require(receiver != 0, "A non-zero reciever address must be provided");
        RecurringTransfer memory recurringTransfer = recurringTransfers[receiver];
        require(recurringTransfer.amount != 0, "A recurring transfer has not been created for this address");
        require(isPastMonth(recurringTransfer.lastTransferTime), "Transfer has already been executed this month");
        require(isOnDayAndBetweenHours(recurringTransfer.transferDay, recurringTransfer.transferHourStart, recurringTransfer.transferHourEnd), "Transfer request not within valid timeframe");

        uint256 transferAmount = getAdjustedTransferAmount(recurringTransfer.token, recurringTransfer.rateToken, recurringTransfer.amount);

        uint256 startGas = gasleft();
        bytes32 txHash = getTransactionHash(
            receiver,
            safeTxGas, dataGas, gasPrice, gasToken, refundReceiver,
            nonce
        );
        require(checkSignatures(txHash, signatures, recurringTransfer.delegate), "Invalid signatures provided");
        // Increase nonce and execute transaction.
        nonce++;
        require(gasleft() >= safeTxGas, "Not enough gas to execute safe transaction");

        recurringTransfers[receiver].lastTransferTime = now;

        if (recurringTransfer.token == 0) {
            require(manager.execTransactionFromModule(receiver, transferAmount, "", Enum.Operation.Call), "Could not execute Ether transfer");
        } else {
            bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", receiver, transferAmount);
            require(manager.execTransactionFromModule(recurringTransfer.token, 0, data, Enum.Operation.Call), "Could not execute token transfer");
        }

        // We transfer the calculated tx costs to the tx.origin to avoid sending it to intermediate contracts that have made calls
        if (gasPrice > 0) {
            require(gasPrice <= gasPriceLimits[gasToken], "Gas price is too high");
            require(dataGas <= dataGasLimits[gasToken], "Data gas is too high");
            handlePayment(startGas, dataGas, gasPrice, gasToken, refundReceiver);
        }
    }

    function isOnDayAndBetweenHours(uint8 day, uint8 hourStart, uint8 hourEnd)
        internal view returns (bool)
    {
        return dateTime.getDay(now) == day &&
        dateTime.getHour(now) >= hourStart &&
        dateTime.getHour(now) < hourEnd;
    }

    function isPastMonth(uint256 previousTime)
        internal view returns (bool)
    {
        return dateTime.getYear(now) > dateTime.getYear(previousTime) ||
        dateTime.getMonth(now) > dateTime.getMonth(previousTime);
    }

    // Adjust amount for the transfer rateToken if it exists
    // For example:
    // say GNO = 1/10 ETH and DAI = 1/200 ETH
    // token = GNO address
    // rateToken = DAI address
    // amount = 1000
    // In other words, we want to pay the receiver $1000 worth of GNO token.
    // Given the rateTokens above, we will pay (1 * 10 * 1000) / (200 * 1) = 50 GNO tokens.
    function getAdjustedTransferAmount(address token, address rateToken, uint256 amount)
        internal view returns (uint)
    {
        // transfer does not need to be adjusted since no rateToken is given
        if(rateToken == 0) {
            return amount;
        }

        uint256 tokenPriceNum = 1;
        uint256 tokenPriceDen = 1;
        // they are transfering a token
        if(token != 0) {
            (tokenPriceNum, tokenPriceDen) = dutchExchange.getPriceOfTokenInLastAuction(token);
        }

        uint256 rateTokenPriceNum;
        uint256 rateTokenPriceDen;
        (rateTokenPriceNum, rateTokenPriceDen) = dutchExchange.getPriceOfTokenInLastAuction(rateToken);

        uint256 adjustedNum = (rateTokenPriceNum * tokenPriceDen * amount);
        uint256 adjustedDen = (rateTokenPriceDen * tokenPriceNum);

        require(adjustedNum != 0, "The adjusted amount numerator must not be 0");
        require(adjustedDen != 0, "The adjusted amount denominator must not be 0");

        return adjustedNum / adjustedDen;
    }


    /// @dev Returns hash to be signed by owners.
    /// @param receiver The address that will receive tokens.
    /// @param safeTxGas Gas that should be used for the Safe transaction.
    /// @param dataGas Gas costs for data used to trigger the safe transaction and to pay the payment transfer
    /// @param gasPrice Gas price that should be used for the payment calculation.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    /// @param _nonce Nonce used for this Safe transaction.
    /// @return Transaction hash.
    function getTransactionHash(
        address receiver,
        uint256 safeTxGas,
        uint256 dataGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    )
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(byte(0x19), byte(0), this, receiver, safeTxGas, dataGas, gasPrice, gasToken, refundReceiver, _nonce)
        );
    }

    function checkSignatures(bytes32 transactionHash, bytes signatures, address delegate)
        internal
        view
        returns (bool)
    {
        address signer = recoverKey(transactionHash, signatures, 0);
        return signer == delegate || OwnerManager(manager).isOwner(signer);
    }

    function handlePayment(
        uint256 gasUsed,
        uint256 dataGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver
    )
        private
    {
        uint256 amount = ((gasUsed - gasleft()) + dataGas) * gasPrice;
        // solium-disable-next-line security/no-tx-origin
        address receiver = refundReceiver == address(0) ? tx.origin : refundReceiver;
        if (gasToken == address(0)) {
            // solium-disable-next-line security/no-send
            require(manager.execTransactionFromModule(receiver, amount, "", Enum.Operation.Call), "Could not pay gas costs with ether");
        } else {
            bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", receiver, amount);
            require(manager.execTransactionFromModule(gasToken, 0, data, Enum.Operation.Call), "Could not pay gas costs with token");
        }
    }
}
