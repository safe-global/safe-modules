const blockTime = require('./blockTime')

const ExposedRecurringTransfersModule = artifacts.require("./ExposedRecurringTransfersModule.sol")

contract('RecurringTransfersModule', function(accounts) {
    let exposedRecurringTransfersModule
    let currentBlockTime
    let currentDateTime

    const SECONDS_IN_DAY = 60 * 60 * 24

    beforeEach(async function() {
        exposedRecurringTransfersModule = await ExposedRecurringTransfersModule.new()
        exposedRecurringTransfersModule._setup(accounts[6])
        currentBlockTime = blockTime.getCurrentBlockTime()
        currentDateTime = blockTime.getUtcDateTime(currentBlockTime)
    });

    it('is currently on day and between hours', async () => {
        const result = await exposedRecurringTransfersModule._isOnDayAndBetweenHours(currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1)
        assert.isTrue(result)
    });

    it('is currently not tomorrow', async () => {
        const result = await exposedRecurringTransfersModule._isOnDayAndBetweenHours(currentDateTime.day + 1, currentDateTime.hour - 1, currentDateTime.hour + 1)
        assert.isFalse(result)
    });

    it('is past month of epoch time 0', async () => {
        const result = await exposedRecurringTransfersModule._isPastMonth(0)
        assert.isTrue(result)
    });

    it('is not past current month', async () => {
        const result = await exposedRecurringTransfersModule._isPastMonth(currentBlockTime)
        assert.isFalse(result)
    });

    it('is past previous month', async () => {
        const result = await exposedRecurringTransfersModule._isPastMonth(currentBlockTime - (currentDateTime.day + 3) * SECONDS_IN_DAY)
        assert.isTrue(result)
    });
});
