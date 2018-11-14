const utils = require('./utils')
const blockTime = require('./blockTime')
const solc = require('solc')
const abi = require('ethereumjs-abi')

const RecurringTransfersModule = artifacts.require("./RecurringTransfersModule.sol")
const ProxyFactory = artifacts.require("./gnosis-safe/contracts/proxies/ProxyFactory.sol")
const CreateAndAddModules = artifacts.require("./gnosis-safe/contracts/libraries/CreateAndAddModules.sol")
const GnosisSafe = artifacts.require("./gnosis-safe/contracts/GnosisSafe.sol")
const MockContract = artifacts.require("MockContract")
const DutchExchange = artifacts.require("DutchExchange")

contract('RecurringTransfersModule', function(accounts) {
    let gnosisSafe
    let recurringTransfersModule

    let currentBlockTime
    let currentDateTime

    const owner = accounts[0]
    const receiver = accounts[1]
    const delegate = accounts[8]
    const rando = accounts[7]
    const transferAmount = parseInt(web3.toWei(1, 'ether'))

    beforeEach(async function() {
        // create mock DutchExchange contract
        dutchExchangeMock = await MockContract.new()
        dutchExchange = await DutchExchange.at(dutchExchangeMock.address)

        // Create lightwallet
        lw = await utils.createLightwallet()

        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModules = await CreateAndAddModules.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()

        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([owner], 1, 0, "0x")
        let recurringTransfersModuleMasterCopy = await RecurringTransfersModule.new()

        // Initialize module master copy
        recurringTransfersModuleMasterCopy.setup(dutchExchange.address)

        // Create Gnosis Safe and Recurring Transfer Module in one transaction
        let moduleData = await recurringTransfersModuleMasterCopy.contract.setup.getData(dutchExchange.address)
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

        // fast forwarding to a consistent time prevents issues
        // tests will start running at roughly 5 AM
        const currentHour = blockTime.getUtcDateTime(blockTime.getCurrentBlockTime()).hour
        blockTime.fastForwardBlockTime((23 - currentHour + 5) * 60 * 60);

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
            "execute recurring transfer",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeStartBalance - transferAmount, safeEndBalance)
        assert.equal(receiverStartBalance + transferAmount, receiverEndBalance)
    })

    it('should transfer ERC20 tokens', async () => {
        const tokenTransferAmount = 10

        // deposit money for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        // Create fake token
        let source = `
        contract TestToken {
            mapping (address => uint) public balances;
            function TestToken() {
                balances[msg.sender] = 100;
            }
            function transfer(address to, uint value) public returns (bool) {
                require(balances[msg.sender] >= value);
                balances[msg.sender] -= value;
                balances[to] += value;
            }
        }`
        let output = await solc.compile(source, 0);

        // Create test token contract
        let contractInterface = JSON.parse(output.contracts[':TestToken']['interface'])
        let contractBytecode = '0x' + output.contracts[':TestToken']['bytecode']
        let transactionHash = await web3.eth.sendTransaction({from: accounts[0], data: contractBytecode, gas: 4000000})
        let receipt = web3.eth.getTransactionReceipt(transactionHash);
        const TestToken = web3.eth.contract(contractInterface)
        let testToken = TestToken.at(receipt.contractAddress)

        // transfer tokens to safe
        await testToken.transfer(gnosisSafe.address, 100, {from: owner})

        const safeStartBalance = await testToken.balances(gnosisSafe.address).toNumber()
        const receiverStartBalance = await testToken.balances(receiver).toNumber()

        utils.logGasUsage(
            "add new recurring transfer",
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, testToken.address, 0, tokenTransferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            "execute recurring transfer",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        const safeEndBalance = await testToken.balances(gnosisSafe.address).toNumber()
        const receiverEndBalance = await testToken.balances(receiver).toNumber()

        assert.equal(safeStartBalance - tokenTransferAmount, safeEndBalance)
        assert.equal(receiverStartBalance + tokenTransferAmount, receiverEndBalance)
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
            "execute 2nd recurring transfer",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeStartBalance - transferAmount * 2, safeEndBalance)
        assert.equal(receiverStartBalance + transferAmount * 2, receiverEndBalance)
    })

    it('should transfer 1 eth then fail the next month after the recurring transfer has been deleted', async () => {
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

        utils.logGasUsage(
            "remove recurring transfer",
            await recurringTransfersModule.removeRecurringTransfer(receiver, {from: owner})
        )

        blockTime.fastForwardBlockTime(blockTime.getBlockTimeNextMonth(currentBlockTime) - currentBlockTime)

        await utils.assertRejects(
            recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner}),
            "executing 2nd recurring transfer fails"
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeStartBalance - transferAmount, safeEndBalance)
        assert.equal(receiverStartBalance + transferAmount, receiverEndBalance)
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

    it('should transfer adjusted value of ERC20 tokens', async () => {
        const tokenTransferAmount = 1000

        // deposit money for execution
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        // Create fake token
        let source = `
        contract TestToken {
            mapping (address => uint) public balances;
            function TestToken() {
                balances[msg.sender] = 1000;
            }
            function transfer(address to, uint value) public returns (bool) {
                require(balances[msg.sender] >= value);
                balances[msg.sender] -= value;
                balances[to] += value;
            }
        }`
        let output = await solc.compile(source, 0);

        // Create test token contract
        let contractInterface = JSON.parse(output.contracts[':TestToken']['interface'])
        let contractBytecode = '0x' + output.contracts[':TestToken']['bytecode']
        let transactionHash = await web3.eth.sendTransaction({from: accounts[0], data: contractBytecode, gas: 4000000})
        let receipt = web3.eth.getTransactionReceipt(transactionHash);
        const TestToken = web3.eth.contract(contractInterface)
        let testToken = TestToken.at(receipt.contractAddress)

        // fake token to mock rate on
        const fakeTestTokenAddress = accounts[4]

        // transfer tokens to safe
        await testToken.transfer(gnosisSafe.address, 1000, {from: owner})

        // save balances at start
        const safeStartBalance = await testToken.balances(gnosisSafe.address).toNumber()
        const receiverStartBalance = await testToken.balances(receiver).toNumber()

        // mock token values
        await dutchExchangeMock.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(testToken.address),
            '0x'+ abi.rawEncode(['uint', 'uint'], [1, 10]).toString('hex')
        )
        await dutchExchangeMock.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(fakeTestTokenAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [1, 200]).toString('hex')
        )

        utils.logGasUsage(
            "add new recurring transfer",
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, testToken.address, fakeTestTokenAddress, tokenTransferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            "execute recurring transfer",
            await recurringTransfersModule.executeRecurringTransfer(receiver, {from: owner})
        )

        const safeEndBalance = await testToken.balances(gnosisSafe.address).toNumber()
        const receiverEndBalance = await testToken.balances(receiver).toNumber()

        assert.equal(safeStartBalance - (tokenTransferAmount / 20), safeEndBalance)
        assert.equal(receiverStartBalance + (tokenTransferAmount / 20), receiverEndBalance)
    })
})
