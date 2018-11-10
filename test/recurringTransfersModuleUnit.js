const ExposedRecurringTransfersModule = artifacts.require("./ExposedRecurringTransfersModule.sol")

contract('ExposedRecurringTransfersModule', function(accounts) {
    it('transfer window unit tests 2', async () => {
        var exposedRecurringTransfersModule = await ExposedRecurringTransfersModule.new()
        var output = await exposedRecurringTransfersModule._isOnDayAndBetweenHours(3,0,0)
        assert.equal(output, false)
    });
});
