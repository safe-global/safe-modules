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

        // tests will start running at 5 AM on the first day of next month
        currentBlockTime = blockTime.getCurrentBlockTime()
        await wait(blockTime.getBlockTimeAtStartOfNextMonth(currentBlockTime) - currentBlockTime)
        
        // update time
        currentBlockTime = blockTime.getCurrentBlockTime()
        currentDateTime = blockTime.getCurrentUtcDateTime()
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
        
    it('should get correct price of token from recurring transfers module', async () => {
        await mockPriceOfTokenInLastAuction(mockGnoAddress, [10, 200])
        
        const result = await exposedRecurringTransfersModule.getPrice(mockGnoAddress)
        expect([result[0].toNumber(), result[1].toNumber()]).to.eql([10, 200])
    })

    it('should get correct price of token in token from recurring transfers module', async () => {
        // there is no past auction between tokens
        await mockAuctionIndex(mockGnoAddress, mockDaiAddress, 0)
        
        // 1 eth = $200
        // mock GNO and DAI values
        // GNO = $20
        // DAI = $1 
        await mockPriceOfTokenInLastAuction(mockGnoAddress, [1e18.toFixed(), 10e18.toFixed()])
        await mockPriceOfTokenInLastAuction(mockDaiAddress, [1e18.toFixed(), 200e18.toFixed()])
          
        const result = await exposedRecurringTransfersModule.getPriceInToken(mockGnoAddress, mockDaiAddress)
        assert.equal(result[0].toNumber(), 10e36.toFixed())
        assert.equal(result[1].toNumber(), 200e36.toFixed())
    })
  
    it('should adjust transfer amount properly for $1000 in GNO tokens when there is no auction between the tokens', async () => {
        // there is no past auction between tokens
        await mockAuctionIndex(mockGnoAddress, mockDaiAddress, 0)
        
        // 1 eth = $200
        // mock GNO and DAI values
        // GNO = $20
        // DAI = $1 
        await mockPriceOfTokenInLastAuction(mockGnoAddress, [1e18.toFixed(), 10e18.toFixed()])
        await mockPriceOfTokenInLastAuction(mockDaiAddress, [1e18.toFixed(), 200e18.toFixed()])
        
        const result = await exposedRecurringTransfersModule.getAdjustedTransferAmount(mockGnoAddress, mockDaiAddress, 1000e18)
        assert.equal(result.toNumber(), 50e18)
    })

    it('should adjust transfer amount properly for $1000 in GNO tokens when there is an auction between the tokens', async () => {
        // there is a past auction between tokens
        await mockAuctionIndex(mockGnoAddress, mockDaiAddress, 1)
        
        // 1 eth = $200
        // mock GNO and DAI values
        // GNO = $20
        // DAI = $1 
        await mockPriceInPastAuction(mockGnoAddress, mockDaiAddress, 1, [1e18.toFixed(), 20e18.toFixed()])

        const result = await exposedRecurringTransfersModule.getAdjustedTransferAmount(mockGnoAddress, mockDaiAddress, 1000e18)
        assert.equal(result.toNumber(), 50e18)
    })

    const mockPriceOfTokenInLastAuction = async (token, price) => {
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(token),
            '0x' + abi.rawEncode(['uint', 'uint'], price).toString('hex')
        )
    }
    
    const mockAuctionIndex = async (token1, token2, index) => {
        await mockDutchExchange.givenCalldataReturnUint(
            await dutchExchange.contract.getAuctionIndex.getData(token1, token2),
            index
        )
    }
    
    const mockPriceInPastAuction = async (token1, token2, index, price) => {
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceInPastAuction.getData(token1, token2, index),
            '0x' + abi.rawEncode(['uint', 'uint'], price).toString('hex')
        )
    }
})
