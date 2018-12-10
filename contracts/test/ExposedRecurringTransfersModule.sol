pragma solidity 0.4.24;

import "../RecurringTransfersModule.sol";

contract ExposedRecurringTransfersModule is RecurringTransfersModule {

    function _isOnDayAndBetweenHours(uint8 day, uint8 hourStart, uint8 hourEnd)
        public view returns (bool)
    {
        return super.isOnDayAndBetweenHours(day, hourStart, hourEnd);
    }

    function _isPastMonth(uint previousTime)
        public view returns (bool)
    {
        return super.isPastMonth(previousTime);
    }

    function _getAdjustedTransferAmount(address token, address rate, uint amount)
        public view returns (uint)
    {
        return super.getAdjustedTransferAmount(token, rate, amount);
    }
}
