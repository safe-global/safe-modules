pragma solidity 0.4.24;

import "../contracts/RecurringTransfersModule.sol";

contract ExposedRecurringTransfersModule is RecurringTransfersModule {
    function _isOnDayAndBetweenHours(uint8 day, uint8 hourStart, uint8 hourEnd)
        public view returns (bool)
    {
        return isOnDayAndBetweenHours(day, hourStart, hourEnd);
    }
}
