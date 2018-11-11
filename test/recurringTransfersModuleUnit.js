const utils = require('./utils')
const blockTime = require('./blockTime')
const abi = require('ethereumjs-abi')

const ExposedRecurringTransfersModule = artifacts.require("./ExposedRecurringTransfersModule.sol")
const MockContract = artifacts.require("MockContract")
const DutchExchange = artifacts.require("DutchExchange")

contract('RecurringTransfersModule', function(accounts) {
    let exposedRecurringTransfersModule
    let currentBlockTime
    let currentDateTime

    const SECONDS_IN_DAY = 60 * 60 * 24

    const mockGnoAddress = utils.randomAddress()
    const mockDaiAddress = utils.randomAddress()

    beforeEach(async function() {
        // create mock DutchExchange contract
        const mock = await MockContract.new()
        const dutchExchange = await DutchExchange.at(mock.address)

        // mock GNO and DAI values
        await mock.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockGnoAddress),
            abi.rawEncode(['uint', 'uint'], [1, 10]).toString()
        )
        await mock.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockDaiAddress),
            abi.rawEncode(['uint', 'uint'], [100, 20000]).toString()
        )

        console.log('mocked value of DAI: ', await dutchExchange.getPriceOfTokenInLastAuction(mockDaiAddress))
        console.log('mock address: ', mock.address)
        console.log('dx address: ', dutchExchange.address)

        // create exposed module
        exposedRecurringTransfersModule = await ExposedRecurringTransfersModule.new()
        exposedRecurringTransfersModule.setup(mock.address)

        // fast forwarding to a consistent time prevents issues
        // tests will start running at roughly 5 AM
        const currentHour = blockTime.getUtcDateTime(blockTime.getCurrentBlockTime()).hour
        blockTime.fastForwardBlockTime((23 - currentHour + 5) * 60 * 60);

        // update time
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

    it('is currently not an hour in the future', async () => {
        const result = await exposedRecurringTransfersModule._isOnDayAndBetweenHours(currentDateTime.day, currentDateTime.hour + 1, currentDateTime.hour + 2)
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

    it('transfer amount is properly adusted for $1000 in GNO tokens', async () => {
        const result = await exposedRecurringTransfersModule._getAdjustedTransferAmount(mockGnoAddress, mockDaiAddress, 1000)
        console.log('dx address in test: ', await exposedRecurringTransfersModule.dutchExchange())
        assert.equal(50, result.toNumber())
    });
});
