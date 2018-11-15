const utils = require('./utils')
const blockTime = require('./blockTime')
const abi = require('ethereumjs-abi')

const ExposedRecurringTransfersModule = artifacts.require("./ExposedRecurringTransfersModule.sol")
const MockContract = artifacts.require("MockContract")
const DutchExchange = artifacts.require("DutchExchange")
const DateTime = artifacts.require("DateTime")

contract('RecurringTransfersModule', function(accounts) {
    let exposedRecurringTransfersModule
    let dutchExchangeMock
    let dutchExchange
    let currentBlockTime
    let currentDateTime

    const SECONDS_IN_DAY = 60 * 60 * 24

    const mockGnoAddress = accounts[3]
    const mockDaiAddress = accounts[4]

    beforeEach(async function() {
        // create mock DutchExchange contract
        dutchExchangeMock = await MockContract.new()
        dutchExchange = await DutchExchange.at(dutchExchangeMock.address)

        // create DateTime contract
        const dateTime = await DateTime.new()

        // create exposed module
        exposedRecurringTransfersModule = await ExposedRecurringTransfersModule.new()
        exposedRecurringTransfersModule.setup(dutchExchangeMock.address, dateTime.address)

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
        // mock GNO and DAI values
        await dutchExchangeMock.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockGnoAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toString(), 10e18.toString()]).toString('hex')
        )
        await dutchExchangeMock.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockDaiAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toString(), 200e18.toString()]).toString('hex')
        )

        const result = await exposedRecurringTransfersModule._getAdjustedTransferAmount(mockGnoAddress, mockDaiAddress, 1000e18)
        assert.equal(result.toNumber(), 50e18)
    });
});
