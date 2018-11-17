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
const DateTime = artifacts.require("DateTime")

contract('RecurringTransfersModule', function(accounts) {
    let gnosisSafe
    let recurringTransfersModule
    let dutchExchange
    let mockDutchExchange

    let currentBlockTime
    let currentDateTime

    const owner = accounts[0]
    const receiver = accounts[1]
    const delegate = accounts[8]
    const rando = accounts[7]
    const transferAmount = parseInt(web3.toWei(1, 'ether'))

    beforeEach(async function() {
        // create mock DutchExchange contract
        mockDutchExchange = await MockContract.new()
        dutchExchange = await DutchExchange.at(mockDutchExchange.address)

        // create DateTime contract
        const dateTime = await DateTime.new()

        // Create lightwallet
        const lw = await utils.createLightwallet()

        // Create Master Copies
        const proxyFactory = await ProxyFactory.new()
        const createAndAddModules = await CreateAndAddModules.new()
        const gnosisSafeMasterCopy = await GnosisSafe.new()

        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([owner], 1, 0, "0x")
        const recurringTransfersModuleMasterCopy = await RecurringTransfersModule.new()

        // Initialize module master copy
        recurringTransfersModuleMasterCopy.setup(dutchExchange.address, dateTime.address)

        // Create Gnosis Safe and Recurring Transfer Module in one transaction
        const moduleData = await recurringTransfersModuleMasterCopy.contract.setup.getData(dutchExchange.address, dateTime.address)
        const proxyFactoryData = await proxyFactory.contract.createProxy.getData(recurringTransfersModuleMasterCopy.address, moduleData)
        const modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
        const createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
        const gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], owner], 2, createAndAddModules.address, createAndAddModulesData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Recurring Transfer Module',
        )
        const modules = await gnosisSafe.getModules()
        recurringTransfersModule = RecurringTransfersModule.at(modules[0])
        assert.equal(gnosisSafe.address, await recurringTransfersModule.manager.call())

        // fast forwarding to a consistent time prevents issues
        // tests will start running at roughly 5 AM
        const currentHour = blockTime.getUtcDateTime(blockTime.getCurrentBlockTime()).hour
        blockTime.fastForwardBlockTime((23 - currentHour + 5) * 60 * 60);

        // update time
        currentBlockTime = blockTime.getCurrentBlockTime()
        currentDateTime = blockTime.getUtcDateTime(currentBlockTime)
    })

    it('should transfer eth', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            'expected recurring transfer to get created',
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            'expected recurring transfer to execute',
            await recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: owner})
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - transferAmount)
        assert.equal(receiverEndBalance, receiverStartBalance + transferAmount)
    })

    it('should transfer ERC20 tokens', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        const tokenTransferAmount = 10
        const token = await createTestToken(owner, tokenTransferAmount);
        await token.transfer(gnosisSafe.address, tokenTransferAmount, {from: owner})
        const safeStartBalance = await token.balances(gnosisSafe.address).toNumber()
        const receiverStartBalance = await token.balances(receiver).toNumber()

        utils.logGasUsage(
            'expected recurring transfer to get created',
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, token.address, 0, tokenTransferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            'expected recurring transfer to execute',
            await recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: owner})
        )

        const safeEndBalance = await token.balances(gnosisSafe.address).toNumber()
        const receiverEndBalance = await token.balances(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - tokenTransferAmount)
        assert.equal(receiverEndBalance, receiverStartBalance + tokenTransferAmount)
    })

    it('should transfer eth then fail on second transfer', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            'expected recurring transfer to get created',
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            'expected recurring transfer to execute',
            await recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: owner})
        )

        await utils.assertRejects(
            recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: owner}),
            'expected recurring transfer to get rejected'
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - transferAmount)
        assert.equal(receiverEndBalance, receiverStartBalance + transferAmount)
    })


    it('should transfer eth then transfer another eth the next month', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            'expected recurring transfer to get created',
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            'expected recurring transfer to execute',
            await recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: owner})
        )

        blockTime.fastForwardBlockTime(blockTime.getBlockTimeNextMonth(currentBlockTime) - currentBlockTime)

        utils.logGasUsage(
            'expected recurring transfer to get rejected',
            await recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: owner})
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - transferAmount * 2)
        assert.equal(receiverEndBalance, receiverStartBalance + transferAmount * 2)
    })

    it('should transfer eth then fail the next month after the recurring transfer has been deleted', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            'expected recurring transfer to get created',
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            'expected recurring transfer to execute',
            await recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: owner})
        )

        utils.logGasUsage(
            'expected recurring transfer to get removed',
            await recurringTransfersModule.removeRecurringTransfer(receiver, {from: owner})
        )

        blockTime.fastForwardBlockTime(blockTime.getBlockTimeNextMonth(currentBlockTime) - currentBlockTime)

        await utils.assertRejects(
            recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: owner}),
            'expected recurring transfer to get rejected'
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - transferAmount)
        assert.equal(receiverEndBalance, receiverStartBalance + transferAmount)
    })

    it('should transfer with delegate', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            'expected recurring transfer to get created',
            await recurringTransfersModule.addRecurringTransfer(
                receiver, delegate, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            'expected recurring transfer to execute',
            await recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: delegate})
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - transferAmount)
        assert.equal(receiverEndBalance, receiverStartBalance + transferAmount)
    })

    it('should reject when rando tries to make transfer', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        utils.logGasUsage(
            'expected recurring transfer to get created',
            await recurringTransfersModule.addRecurringTransfer(
                receiver, delegate, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        await utils.assertRejects(
            recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: rando}),
            'expected recurring transfer to get rejected'
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance)
        assert.equal(receiverEndBalance, receiverStartBalance)
    })

    it('should transfer adjusted value of ERC20 tokens', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        const tokenTransferAmount = 1e18
        const token1 = await createTestToken(owner, tokenTransferAmount)
        const token2Address = '0x1'
        await token1.transfer(gnosisSafe.address, tokenTransferAmount, {from: owner})
        const safeStartBalance = await token1.balances(gnosisSafe.address).toNumber()
        const receiverStartBalance = await token1.balances(receiver).toNumber()

        // mock token values
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(token1.address),
            '0x'+ abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 10e18.toFixed()]).toString('hex')
        )
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(token2Address),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 200e18.toFixed()]).toString('hex')
        )

        utils.logGasUsage(
            'expected recurring transfer to get created',
            await recurringTransfersModule.addRecurringTransfer(
                receiver, 0, token1.address, token2Address, tokenTransferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1, {from: owner}
            )
        )

        utils.logGasUsage(
            'expected recurring transfer to execute',
            await recurringTransfersModule.executeRecurringTransfer(receiver, 0, 0, 0, 0, 0, {from: owner})
        )

        const safeEndBalance = await token1.balances(gnosisSafe.address).toNumber()
        const receiverEndBalance = await token1.balances(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - (tokenTransferAmount / 20))
        assert.equal(receiverEndBalance, receiverStartBalance + (tokenTransferAmount / 20))
    })
})

async function createTestToken(creator, balance) {
    let source = `
    contract TestToken {
      mapping (address => uint) public balances;
      function TestToken() {
          balances[msg.sender] = ${balance.toFixed()};
      }
      function transfer(address to, uint value) public returns (bool) {
          require(balances[msg.sender] >= value);
          balances[msg.sender] -= value;
          balances[to] += value;
      }
    }`
    let output = await solc.compile(source, 0);

    let contractInterface = JSON.parse(output.contracts[':TestToken']['interface'])
    let contractBytecode = '0x' + output.contracts[':TestToken']['bytecode']
    let transactionHash = await web3.eth.sendTransaction({from: creator, data: contractBytecode, gas: 4000000})
    let receipt = web3.eth.getTransactionReceipt(transactionHash);
    const TestToken = web3.eth.contract(contractInterface)
    return TestToken.at(receipt.contractAddress)
}
