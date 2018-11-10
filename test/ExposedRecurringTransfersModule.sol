pragma solidity 0.4.24;

import "../contracts/RecurringTransfersModule.sol";

contract ExposedRecurringTransfersModule is RecurringTransfersModule {
    function _setup(address dx) public {
        super.setup(dx);
    }

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
}
