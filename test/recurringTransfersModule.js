const utils = require('./utils')

const RecurringTransfersModule = artifacts.require("./RecurringTransfersModule.sol")
const ProxyFactory = artifacts.require("./gnosis-safe/contracts/proxies/ProxyFactory.sol")
const CreateAndAddModules = artifacts.require("./gnosis-safe/contracts/libraries/CreateAndAddModules.sol")
const GnosisSafe = artifacts.require("./gnosis-safe/contracts/GnosisSafe.sol")
const DutchExchangeProxy = artifacts.require("DutchExchangeProxy")

const SECONDS_IN_DAY = 60 * 60 * 24

contract('RecurringTransfersModule', function(accounts) {
    let gnosisSafe
    let recurringTransfersModule
    let dutchExchange
    let dxAddress

    const currentBlockTime = utils.currentBlockTime()
    const currentDate = new Date(currentBlockTime * 1000)
    const currentYear = currentDate.getUTCFullYear()
    const currentMonth = currentDate.getUTCMonth()
    const currentDay = currentDate.getUTCDate()
    const currentHour = currentDate.getUTCHours()
    var thisTimeNextMonth
    if(currentMonth == 11) {
        thisTimeNextMonth = Date.UTC(currentYear + 1, 0, currentDay, currentHour, 0, 0) / 1000
    } else {
        thisTimeNextMonth = Date.UTC(currentYear, currentMonth + 1, currentDay, currentHour, 0, 0) / 1000
    }

    const owner = accounts[0]
    const receiver = accounts[1]
    const delegate = accounts[8]
    const transferAmount = parseInt(web3.toWei(1, 'ether'))

    beforeEach(async function() {
        // Create lightwallet
        lw = await utils.createLightwallet()

        // create dutch dutchExchange
        //dutchExchange = await DutchExchange.new()
        dxProxy = await DutchExchangeProxy.deployed()
        dxAddress = dxProxy.address

        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModules = await CreateAndAddModules.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()

        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([accounts[0]], 1, 0, "0x")
        let recurringTransfersModuleMasterCopy = await RecurringTransfersModule.new()

        // Initialize module master copy
        recurringTransfersModuleMasterCopy.setup(dxAddress)

        // Create Gnosis Safe and Recurring Transfer Module in one transaction
        let moduleData = await recurringTransfersModuleMasterCopy.contract.setup.getData(dxAddress)
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(recurringTransfersModuleMasterCopy.address, moduleData)
        let modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], owner], 2, createAndAddModules.address, createAndAddModulesData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Recurring Transfer Module',
        )
        let modules = await gnosisSafe.getModules()
        recurringTransfersModule = RecurringTransfersModule.at(modules[0])
        assert.equal(await recurringTransfersModule.manager.call(), gnosisSafe.address)
    })

    it('transfer window unit tests', async () => {
        assert.isTrue(
            await recurringTransfersModule.isNextMonth(0),
            "has been a month since time 0"
        )

        assert.isTrue(
            await recurringTransfersModule.isNextMonth(currentBlockTime - (currentDay + 5) * SECONDS_IN_DAY),
            "has been a month since current time minus one month"
        )

        assert.isFalse(
            await recurringTransfersModule.isNextMonth(currentBlockTime),
            "has not been a month since current time"
        )

        assert.isTrue(
            await recurringTransfersModule.isOnDayAndBetweenHours(currentDay, currentHour - 1, currentHour + 1),
            "is on same day and between hours"
        )

        assert.isFalse(
            await recurringTransfersModule.isOnDayAndBetweenHours(currentDay, currentHour + 1, currentHour + 2),
            "is not on same day and between different hours"
        )
    })

    it('should transfer 1 eth', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            "add new recurring transfer",
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, 0, 0, transferAmount, currentDay, currentHour - 1, currentHour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            "execute 1st recurring transfer",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeStartBalance - transferAmount, safeEndBalance)
        assert.equal(receiverStartBalance + transferAmount, receiverEndBalance)
    })

    it('should transfer 1 eth then fail on second transfer', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            "add new recurring transfer",
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, 0, 0, transferAmount, currentDay, currentHour - 1, currentHour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            "execute 1st recurring transfer",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        await utils.assertRejects(
            recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner}),
            "executing 2nd recurring transfer fails"
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeStartBalance - transferAmount, safeEndBalance)
        assert.equal(receiverStartBalance + transferAmount, receiverEndBalance)
    })


    it('should transfer 1 eth then transfer another 1 eth the next month', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            "add new recurring transfer",
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, 0, 0, transferAmount, currentDay, currentHour - 1, currentHour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            "execute 1st recurring transfer",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        await utils.fastForwardBlockTime(thisTimeNextMonth - currentBlockTime)

        utils.logGasUsage(
            "executing 2nd recurring transfer fails",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeStartBalance - transferAmount * 2, safeEndBalance)
        assert.equal(receiverStartBalance + transferAmount * 2, receiverEndBalance)
    })


    it('should transfer 1 eth then transfer another 1 eth the next month', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            "add new recurring transfer",
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, 0, 0, transferAmount, currentDay, currentHour - 1, currentHour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            "execute 1st recurring transfer",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        await utils.fastForwardBlockTime(thisTimeNextMonth - currentBlockTime)

        utils.logGasUsage(
            "executing 2nd recurring transfer fails",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeStartBalance - transferAmount * 2, safeEndBalance)
        assert.equal(receiverStartBalance + transferAmount * 2, receiverEndBalance)
    })

    it('price bullshit', async () => {
        console.log(dxAddress);
        console.log(await recurringTransfersModule.getUSDETHPrice(accounts[3]));
    })
})
