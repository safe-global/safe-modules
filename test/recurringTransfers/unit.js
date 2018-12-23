const utils = require('gnosis-safe/test/utils')
const blockTime = require('./blockTime')
const abi = require('ethereumjs-abi')
const { wait, waitUntilBlock } = require('@digix/tempo')(web3);

const ExposedRecurringTransfersModule = artifacts.require("./test/ExposedRecurringTransfersModule.sol")
const DutchExchange = artifacts.require("./external/DutchExchange.sol")
const MockContract = artifacts.require("MockContract")
const DateTime = artifacts.require("DateTime")

const SECONDS_IN_DAY = 60 * 60 * 24

contract('RecurringTransfersModule', function(accounts) {
    let exposedRecurringTransfersModule
    let mockDutchExchange
    let dutchExchange
    let currentBlockTime
    let currentDateTime

    const mockGnoAddress = '0x1'
    const mockDaiAddress = '0x2'

    beforeEach(async function() {
        // create mock DutchExchange contract
        mockDutchExchange = await MockContract.new()
        dutchExchange = await DutchExchange.at(mockDutchExchange.address)

        // create exposed module
        exposedRecurringTransfersModule = await ExposedRecurringTransfersModule.new()
        await exposedRecurringTransfersModule.setup(dutchExchange.address)

        // fast forwarding to a consistent time prevents issues
        // tests will start running at roughly 5 AM
        const currentHour = blockTime.getUtcDateTime(blockTime.getCurrentBlockTime()).hour
        await wait((23 - currentHour + 5) * 60 * 60);

        // update time
        currentBlockTime = blockTime.getCurrentBlockTime()
        currentDateTime = blockTime.getUtcDateTime(currentBlockTime)
    })

    it('is currently on day and between hours', async () => {
        const result = await exposedRecurringTransfersModule._isOnDayAndBetweenHours(currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1)
        assert.isTrue(result)
    })

    it('is currently not tomorrow', async () => {
        const result = await exposedRecurringTransfersModule._isOnDayAndBetweenHours(currentDateTime.day + 1, currentDateTime.hour - 1, currentDateTime.hour + 1)
        assert.isFalse(result)
    })

    it('is currently not an hour in the future', async () => {
        const result = await exposedRecurringTransfersModule._isOnDayAndBetweenHours(currentDateTime.day, currentDateTime.hour + 1, currentDateTime.hour + 2)
        assert.isFalse(result)
    })

    it('is past month of epoch time 0', async () => {
        const result = await exposedRecurringTransfersModule._isPastMonth(0)
        assert.isTrue(result)
    })

    it('is not past current month', async () => {
        const result = await exposedRecurringTransfersModule._isPastMonth(currentBlockTime)
        assert.isFalse(result)
    })

    it('is past previous month', async () => {
        const result = await exposedRecurringTransfersModule._isPastMonth(currentBlockTime - (currentDateTime.day + 3) * SECONDS_IN_DAY)
        assert.isTrue(result)
    })
    
    it('should get correct price of token from dutch exchange', async () => {
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockGnoAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [10, 200]).toString('hex')
        )
        const result = await dutchExchange.getPriceOfTokenInLastAuction(mockGnoAddress)
        expect([result[0].toNumber(), result[1].toNumber()]).to.eql([10, 200])
    })
    
    it('should get correct price of token from recurring transfers module', async () => {
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockGnoAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [10, 200]).toString('hex')
        )
        
        const result = await exposedRecurringTransfersModule.getPrice(mockGnoAddress)
        expect([result[0].toNumber(), result[1].toNumber()]).to.eql([10, 200])
    })

    // fails
    it('should get correct price of token in token from recurring transfers module', async () => {
        // make sure there is no auction between tokens
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getAuctionIndex.getData(mockGnoAddress, mockDaiAddress),
            '0x' + abi.rawEncode(['uint'], [0]).toString('hex')
        )
        // 1 eth = $200
        // mock GNO and DAI values
        // GNO = $20
        // DAI = $1 
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockGnoAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 10e18.toFixed()]).toString('hex')
        )
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockDaiAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 200e18.toFixed()]).toString('hex')
        )
        
        const result = await exposedRecurringTransfersModule.getPriceInToken(mockGnoAddress, mockDaiAddress)
        assert.equal(result[0].toNumber(), 10e18.toFixed())
        assert.equal(result[1].toNumber(), 200e18.toFixed())
    })
  
    // fails
    it('should adjust transfer amount properly for $1000 in GNO tokens when there is no auction between the tokens', async () => {
        // make sure there is no auction between tokens
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getAuctionIndex.getData(mockGnoAddress, mockDaiAddress),
            '0x' + abi.rawEncode(['uint'], [0]).toString('hex')
        )
        // 1 eth = $200
        // mock GNO and DAI values
        // GNO = $20
        // DAI = $1 
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockGnoAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 10e18.toFixed()]).toString('hex')
        )
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockDaiAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 200e18.toFixed()]).toString('hex')
        )
        
        const result = await exposedRecurringTransfersModule.getAdjustedTransferAmount(mockGnoAddress, mockDaiAddress, 1000e18)
        assert.equal(result.toNumber(), 50e18)
    })

    it('should adjust transfer amount properly for $1000 in GNO tokens when there is an auction between the tokens', async () => {
        // make sure there is no auction between tokens
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getAuctionIndex.getData(mockGnoAddress, mockDaiAddress),
            '0x' + abi.rawEncode(['uint'], [1]).toString('hex')
        )
        // 1 eth = $200
        // mock GNO and DAI values
        // GNO = $20
        // DAI = $1 
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceInPastAuction.getData(mockGnoAddress, mockDaiAddress, 1),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 20e18.toFixed()]).toString('hex')
        )

        const result = await exposedRecurringTransfersModule.getAdjustedTransferAmount(mockGnoAddress, mockDaiAddress, 1000e18)
        assert.equal(result.toNumber(), 50e18)
    })
})
