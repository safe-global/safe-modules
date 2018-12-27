pragma solidity ^0.5.0;

import "../base/Module.sol";
import "../base/ModuleManager.sol";
import "../base/OwnerManager.sol";
import "../common/Enum.sol";
import "../common/SignatureDecoder.sol";
import "../common/SecuredTokenTransfer.sol";
import "../external/DutchExchangeInterface.sol";
import "../external/PriceOracleInterface.sol";
import "../external/SafeMath.sol";


/// @title Transfer Limit Module - Allows to transfer limited amounts of ERC20 tokens and Ether.
contract TransferLimitModule is Module, SignatureDecoder, SecuredTokenTransfer {
    using SafeMath for uint256;

    string public constant NAME = "Transfer Limit Module";
    string public constant VERSION = "0.0.1";

    // keccak256(
    //     "EIP712Domain(address verifyingContract)"
    // );
    bytes32 public constant DOMAIN_SEPARATOR_TYPEHASH = 0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749;

    // keccak256(
    //     "TransferLimitTx(address token,address to,uint256 amount,uint256 refund,address gasToken,address refundReceiver,uint256 nonce)"
    // );
    bytes32 public constant TX_TYPEHASH = 0x7e238b3eff6b836db6c4c9737afec4334a0d6dd13c3bbba4407f3e8506784733;

    bytes32 public domainSeparator;

    // transferLimits mapping maps token address to transfer limit settings.
    mapping (address => TransferLimit) public transferLimits;

    // Time period for which the transfer limits apply, in seconds.
    uint256 public timePeriod;

    // Start of the time period, during which the last transfer occured (common for all tokens).
    uint256 public lastStartTime;

    // If true, the expenditure between [now - timePeriod, now] will be considered.
    bool public rolling;

    // Global limit on all transfers, specified in Wei.
    uint256 public globalWeiCap;

    // Total amount of Wei spent in current time period.
    uint256 public totalWeiSpent;

    // Global limit on transfers, specified in usd (dai).
    uint256 public globalDaiCap;

    // Total amount of dai spent in current time period.
    uint256 public totalDaiSpent;

    // Number of required confirmations for a transfer.
    uint256 public threshold;

    uint256 public nonce;

    // Non-owner address who is allowed to perform transfers.
    address public delegate;

    // DutchExchange contract used as price oracle.
    DutchExchange dutchx;

    struct TransferLimit {
        uint256 limit;
        uint256 spent;
    }

    /// @dev Setup function sets initial storage of contract.
    /// @param tokens List of token addresses. Ether is represented with address 0x0.
    /// @param _transferLimits List of transfer limits in smalles units (e.g. Wei for Ether).
    /// @param _timePeriod Time period for which the transfer limits apply, in seconds, between [1 hour, 1 year).
    /// @param _rolling If true, the expenditure between [now - timePeriod, now] will be considered.
    /// @param _globalWeiCap Global limit on transfers, specified in Wei.
    /// @param _globalDaiCap Global limit on transfers, specified in dai.
    /// @param _threshold Number of required confirmations, within the range [1, safeThreshold - 1].
    /// @param _delegate A non-owner address who is allowed to perform transfers within limits (optional).
    /// @param _dutchxAddr Address of DutchX contract, which is used as price oracle.
    function setup(
        address[] memory tokens,
        uint256[] memory _transferLimits,
        uint256 _timePeriod,
        bool _rolling,
        uint256 _globalWeiCap,
        uint256 _globalDaiCap,
        uint256 _threshold,
        address _delegate,
        address _dutchxAddr
    )
        public
    {
        setManager();

        require(domainSeparator == 0, "Domain Separator already set!");
        // Greater than 1 hour and less than 1 year.
        require(isValidTimePeriod(_timePeriod), "Invalid time period");
        // In the range [1, safeThreshold - 1]
        require(isValidThreshold(_threshold), "Invalid threshold");
        require(_dutchxAddr != address(0), "Invalid dutchx address");

        domainSeparator = keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, this));

        timePeriod = _timePeriod;
        rolling = _rolling;
        globalWeiCap = _globalWeiCap;
        globalDaiCap = _globalDaiCap;
        threshold = _threshold;
        delegate = _delegate;
        dutchx = DutchExchange(_dutchxAddr);

        for (uint256 i = 0; i < tokens.length; i++) {
            transferLimits[tokens[i]].limit = _transferLimits[i];
        }
    }

    /// @dev Allows to update the transfer limit for a specified token. This can only be done via a Safe transaction.
    /// @param token Token contract address.
    /// @param transferLimit Transfer limit in smallest token unit.
    function changeTransferLimit(address token, uint256 transferLimit)
        public
        authorized
    {
        transferLimits[token].limit = transferLimit;
    }

    /// @dev Updates the delegate. This can only be done via a Safe transaction.
    /// @param _delegate New delegate, who is a non-owner account also allowed to make transfers.
    function setDelegate(address _delegate)
        public
        authorized
    {
        delegate = _delegate;
    }

    /// @dev Returns if Safe transaction is a valid transfer limit transaction.
    /// @param token Address of the token that should be transfered (0 for Ether)
    /// @param to Address to which the tokens should be transfered
    /// @param amount Amount of tokens (or Wei) that should be transfered
    /// @param refund Gas to be refunded to relayer (gasPrice*gasLimit).
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    /// @param signatures Packed signature data ({bytes32 r}{bytes32 s}{uint8 v})
    /// @return Returns if transaction can be executed.
    function executeTransferLimit(
        address token,
        address to,
        uint256 amount,
        uint256 refund,
        address gasToken,
        address refundReceiver,
        bytes memory signatures
    )
        public
    {
        require(to != address(0), "Invalid to address provided");
        require(amount > 0, "Invalid amount provided");

        bytes32 txHash = getTransactionHash(
            token, to, amount,
            refund, gasToken, refundReceiver,
            nonce
        );
        require(checkSignatures(txHash, signatures), "Invalid signatures provided");
        // Increase nonce and execute transaction.
        nonce++;

        // If time period is over, reset expenditure.
        if (isPeriodOver()) {
            TransferLimit storage transferLimit = transferLimits[token];
            transferLimit.spent = 0;
            totalWeiSpent = 0;
            totalDaiSpent = 0;
        }

        // Validate that transfer is not exceeding transfer limit, and
        // update state to keep track of spent values.
        require(handleTransferLimits(token, amount), "Transfer exceeds limits");

        // Perform transfer by invoking manager
        if (token == address(0)) {
            require(manager.execTransactionFromModule(to, amount, "", Enum.Operation.Call), "Could not execute ether transfer");
        } else {
            bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", to, amount);
            require(manager.execTransactionFromModule(token, 0, data, Enum.Operation.Call), "Could not execute token transfer");
        }

        // We transfer the calculated tx costs to the tx.origin to avoid sending it to intermediate contracts that have made calls
        if (refund > 0) {
            handlePayment(refund, gasToken, refundReceiver);
        }
    }

    /// @dev Returns hash to be signed by owners.
    /// @param token Address of the token that should be transfered (0 for Ether)
    /// @param to Address to which the tokens should be transfered
    /// @param amount Amount of tokens (or Wei) that should be transfered
    /// @param _nonce Nonce used for this Safe transaction.
    /// @param refund Gas to be refunded to relayer (gasPrice*gasLimit).
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getTransactionHash(
        address token,
        address to,
        uint256 amount,
        uint256 refund,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    )
        public
        view
        returns (bytes32)
    {
        bytes32 txHash = keccak256(
            abi.encode(TX_TYPEHASH, token, to, amount, refund, gasToken, refundReceiver, _nonce)
        );
        return keccak256(
            abi.encodePacked(byte(0x19), byte(0x01), domainSeparator, txHash)
        );
    }

    /// @dev Returns start of the current time period.
    /// @return Unix timestamp.
    function currentStartTime()
        public
        view
        returns (uint)
    {
        return now - (now % timePeriod);
    }

    function handleTransferLimits(address token, uint256 amount)
        internal
        returns (bool)
    {
        TransferLimit storage transferLimit = transferLimits[token];
        // Transfer + previous expenditure shouldn't exceed limit specified for token.
        if (transferLimit.spent.add(amount) > transferLimit.limit) {
            return false;
        }

        // If a global cap is set, transfer amount + value of all
        // previous expenditures (for all tokens) shouldn't exceed global limit.
        if (!isUnderGlobalCap(token, amount)) {
            return false;
        }

        transferLimits[token].spent = transferLimits[token].spent.add(amount);

        return true;
    }

    function isUnderGlobalCap(address token, uint256 amount)
        internal
        returns (bool)
    {
        if (globalWeiCap == 0 && globalDaiCap == 0) {
            return true;
        }

        // Calculate value in ether.
        uint256 ethNum;
        uint256 ethDen;
        (ethNum, ethDen) = getEthAmount(token, amount);

        // Convert ether to wei
        uint256 weiAmount = ethNum.mul(10**18).div(ethDen);
        uint256 weiSpent = totalWeiSpent.add(weiAmount);
        if (globalWeiCap > 0 && weiSpent > globalWeiCap) {
            return false;
        }
        totalWeiSpent = weiSpent;

        if (globalDaiCap != 0) {
            // Calculate value in dai.
            uint256 daiNum;
            uint256 daiDen;
            (daiNum, daiDen) = getDaiAmount(ethNum, ethDen);

            uint256 daiAmount = daiNum.div(daiDen);
            uint256 daiSpent = totalDaiSpent.add(daiAmount);
            if (daiSpent > globalDaiCap) {
                return false;
            }
            totalDaiSpent = daiSpent;
        }

        return true;
    }

    function isPeriodOver()
        internal
        returns (bool)
    {
        if (rolling && now > lastStartTime + timePeriod) {
            lastStartTime = now;
            return true;
        } else if (!rolling && currentStartTime() > lastStartTime) {
            lastStartTime = currentStartTime();
            return true;
        }

        return false;
    }

    function isValidTimePeriod(uint256 _timePeriod)
        internal
        pure
        returns (bool)
    {
        if  (_timePeriod >= 1 hours &&
             _timePeriod < 365 days) {
            return true;
        }

        return false;
    }

    function isValidThreshold(uint256 _threshold)
        internal
        view
        returns (bool)
    {
        if  (_threshold >= 1 &&
             _threshold < OwnerManager(address(manager)).getThreshold()) {
            return true;
        }

        return false;
    }

    function checkSignatures(bytes32 transactionHash, bytes memory signatures)
        internal
        view
        returns (bool)
    {
        // Check that the provided signature data is not too short
        if (signatures.length < threshold * 65) {
            return false;
        }

        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint256 i;

        // Validate threshold is reached.
        for (i = 0; i < threshold; i++) {
            currentOwner = recoverKey(transactionHash, signatures, i);

            // Signatures must be sorted by their address, and
            // there shouldn't be duplicates.
            if (currentOwner <= lastOwner) {
                return false;
            }

            // Signer should either be one of the owners, or the delegate
            if (currentOwner != delegate && !OwnerManager(address(manager)).isOwner(currentOwner)) {
                return false;
            }

            lastOwner = currentOwner;
        }

        return true;
    }

    function getEthAmount(address token, uint256 amount)
        internal
        returns (uint256, uint256)
    {
        // Amount is in wei
        if (token == address(0)) {
            return (amount, 10**18);
        }

        uint256 num;
        uint256 den;
        (num, den) = dutchx.getPriceOfTokenInLastAuction(token);
        require(num != 0, "Price of token is zero");
        require(den != 0, "Price denominator is zero");

        return (amount.mul(num), den);
    }

    function getDaiAmount(uint256 ethNum, uint256 den)
        internal
        view
        returns (uint256, uint256)
    {
        PriceOracleInterface priceOracle = PriceOracleInterface(dutchx.ethUSDOracle());
        uint256 ethDaiPrice = priceOracle.getUSDETHPrice();
        require(ethDaiPrice != 0, "USDETH price is zero");
        return (ethNum.mul(ethDaiPrice), den);
    }

    function handlePayment(
        uint256 amount,
        address gasToken,
        address refundReceiver
    )
        private
    {
        // Make sure refund is within transfer limits, to prevent
        // attacker with a compromised key to empty the safe.
        require(handleTransferLimits(gasToken, amount), "Gas refund exceeds transfer limit");

        // solium-disable-next-line security/no-tx-origin
        address receiver = refundReceiver == address(0) ? tx.origin : refundReceiver;
        if (gasToken == address(0)) {
            require(manager.execTransactionFromModule(receiver, amount, "", Enum.Operation.Call), "Could not refund gas");
        } else {
            bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", receiver, amount);
            require(manager.execTransactionFromModule(gasToken, 0, data, Enum.Operation.Call), "Could not refund token gas");
        }
    }
}
