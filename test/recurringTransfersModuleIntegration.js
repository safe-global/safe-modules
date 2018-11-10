const utils = require('./utils')
const blockTime = require('./blockTime')

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

    let currentBlockTime
    let currentDateTime

    const owner = accounts[0]
    const receiver = accounts[1]
    const delegate = accounts[8]
    const rando = accounts[7]
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

        // update time
        currentBlockTime = blockTime.getCurrentBlockTime()
        currentDateTime = blockTime.getUtcDateTime(currentBlockTime)
    })

    it('should transfer 1 eth', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            "add new recurring transfer",
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
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
                receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
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
                receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            "execute 1st recurring transfer",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        blockTime.fastForwardBlockTime(blockTime.getBlockTimeNextMonth(currentBlockTime) - currentBlockTime)

        utils.logGasUsage(
            "executing 2nd recurring transfer fails",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeStartBalance - transferAmount * 2, safeEndBalance)
        assert.equal(receiverStartBalance + transferAmount * 2, receiverEndBalance)
    })


    it('should transfer with delegate', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            "add new recurring transfer with delegate",
            await recurringTransfersModule.addRecurringTransfer(
                receiver, delegate, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            "execute recurring transfer",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: delegate})
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeStartBalance - transferAmount, safeEndBalance)
        assert.equal(receiverStartBalance + transferAmount, receiverEndBalance)
    })

    it('should reject when rando tries to make transfer', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            "add new recurring transfer with delegate",
            await recurringTransfersModule.addRecurringTransfer(
                receiver, delegate, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        await utils.assertRejects(
            recurringTransfersModule.executeRecurringTransfer(receiver, {from: rando}),
            "execute recurring transfer should be rejected"
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeStartBalance, safeEndBalance)
        assert.equal(receiverStartBalance, receiverEndBalance)
    })

    it('price bullshit', async () => {
        console.log(dxAddress);
        console.log(await recurringTransfersModule.getUSDETHPrice(accounts[3]));
    })
})
