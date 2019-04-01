const utils = require('@gnosis.pm/safe-contracts/test/utils')
const blockTime = require('./blockTime')
const solc = require('solc')
const abi = require('ethereumjs-abi')
const { wait, waitUntilBlock } = require('@digix/tempo')(web3);

const RecurringTransfersModule = artifacts.require("./RecurringTransfersModule.sol")
const DutchExchange = artifacts.require("./external/DutchExchange.sol")
const ProxyFactory = artifacts.require("@gnosis.pm/safe-contracts/contracts/proxies/ProxyFactory.sol")
const CreateAndAddModules = artifacts.require("@gnosis.pm/safe-contracts/contracts/libraries/CreateAndAddModules.sol")
const GnosisSafe = artifacts.require("@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol")
const MockContract = artifacts.require("MockContract")

const GAS_PRICE = 25000000000;

contract('RecurringTransfersModule', function(accounts) {
    let lw
    let gnosisSafe
    let recurringTransfersModule
    let dutchExchange
    let mockDutchExchange

    let currentBlockTime
    let currentDateTime

    const CALL = 0
    const owner = accounts[0]
    const receiver = accounts[1]
    const relayer = accounts[2]
    const transferAmount = parseInt(web3.toWei(1, 'ether'))

    beforeEach(async function() {
        // create mock DutchExchange contract
        mockDutchExchange = await MockContract.new()
        dutchExchange = await DutchExchange.at(mockDutchExchange.address)

        // Create lightwallet
        lw = await utils.createLightwallet()

        // Create Master Copies
        const proxyFactory = await ProxyFactory.new()
        const createAndAddModules = await CreateAndAddModules.new()
        const gnosisSafeMasterCopy = await GnosisSafe.new()

        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([owner], 1, 0, "0x")
        const recurringTransfersModuleMasterCopy = await RecurringTransfersModule.new()

        // Create Gnosis Safe and Recurring Transfer Module in one transaction
        const moduleData = await recurringTransfersModuleMasterCopy.contract.setup.getData(dutchExchange.address)
        const proxyFactoryData = await proxyFactory.contract.createProxy.getData(recurringTransfersModuleMasterCopy.address, moduleData)
        const modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
        const createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
        const gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], owner], 1, createAndAddModules.address, createAndAddModulesData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Recurring Transfer Module',
        )
        const modules = await gnosisSafe.getModules()
        recurringTransfersModule = RecurringTransfersModule.at(modules[0])
        assert.equal(gnosisSafe.address, await recurringTransfersModule.manager.call())

        // tests will start running at 5 AM on the first day of next month
        currentBlockTime = blockTime.getCurrentBlockTime()
        await wait(blockTime.getBlockTimeAtStartOfNextMonth(currentBlockTime) - currentBlockTime)

        // update time
        currentBlockTime = blockTime.getCurrentBlockTime()
        currentDateTime = blockTime.getCurrentUtcDateTime()
    })

    it('should transfer eth', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        const signer = lw.accounts[0]

        const addParams = [receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1]
        const transferParams = [receiver, 0, 0, 0, 0, 0]
        await addRecurringTransfer(addParams, signer)
        await executeRecurringTransfer(transferParams, signer)

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - transferAmount, "expected safe balance to decrease after transfer")
        assert.equal(receiverEndBalance, receiverStartBalance + transferAmount, "expected receiver balance to increase after transfer")
    })

    it('should transfer ERC20 tokens', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        const tokenTransferAmount = 10
        const token = await createTestToken(owner, tokenTransferAmount);
        await token.transfer(gnosisSafe.address, tokenTransferAmount, {from: owner})
        const safeStartBalance = await token.balances(gnosisSafe.address).toNumber()
        const receiverStartBalance = await token.balances(receiver).toNumber()
        const signer = lw.accounts[0]

        const addParams = [receiver, 0, token.address, 0, tokenTransferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1]
        const transferParams = [receiver, 0, 0, 0, 0, 0]
        await addRecurringTransfer(addParams, signer)
        await executeRecurringTransfer(transferParams, signer)

        const safeEndBalance = await token.balances(gnosisSafe.address).toNumber()
        const receiverEndBalance = await token.balances(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - tokenTransferAmount, "expected safe token balance to decrease after transfer")
        assert.equal(receiverEndBalance, receiverStartBalance + tokenTransferAmount, "expected receiver token balance to increase after transfer")
    })

    it('should transfer eth then fail on second transfer', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        const signer = lw.accounts[0]

        const addParams = [receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1]
        const transferParams = [receiver, 0, 0, 0, 0, 0]
        await addRecurringTransfer(addParams, signer)
        await executeRecurringTransfer(transferParams, signer)

        const transfer2Sig = await signModuleTx(recurringTransfersModule, transferParams, lw, [signer])
        await utils.assertRejects(
            recurringTransfersModule.executeRecurringTransfer(...transferParams, transfer2Sig, {from: relayer}),
            'expected recurring transfer to get rejected'
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - transferAmount, "expected safe balance to decrease after transfer")
        assert.equal(receiverEndBalance, receiverStartBalance + transferAmount, "expected receiver balance to increase after transfer")
    })

    it('should transfer eth then transfer another eth the next month', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        const signer = lw.accounts[0]

        const addParams = [receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1]
        const transferParams = [receiver, 0, 0, 0, 0, 0]
        await addRecurringTransfer(addParams, signer)
        await executeRecurringTransfer(transferParams, signer)
        await wait(blockTime.getBlockTimeNextMonth(currentBlockTime) - currentBlockTime)
        await executeRecurringTransfer(transferParams, signer)

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - transferAmount * 2, "expected safe balance to decrease after transfer")
        assert.equal(receiverEndBalance, receiverStartBalance + transferAmount * 2, "expected receiver balance to increase after transfer")
    })

    it('should transfer eth then fail the next month after the recurring transfer has been deleted', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        const signer = lw.accounts[0]

        const addParams = [receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1]
        const transferParams = [receiver, 0, 0, 0, 0, 0]
        const removeParams = [receiver]
        await addRecurringTransfer(addParams, signer)
        await executeRecurringTransfer(transferParams, signer)
        await removeRecurringTransfer(removeParams, signer)
        await wait(blockTime.getBlockTimeNextMonth(currentBlockTime) - currentBlockTime)

        const transfer2Sig = await signModuleTx(recurringTransfersModule, transferParams, lw, [signer])
        await utils.assertRejects(
            recurringTransfersModule.executeRecurringTransfer(...transferParams, transfer2Sig, {from: relayer}),
            'expected recurring transfer to get rejected'
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - transferAmount, "expected safe balance to decrease after transfer")
        assert.equal(receiverEndBalance, receiverStartBalance + transferAmount, "expected receiver balance to increase after transfer")
    })

    it('should transfer with delegate', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        const signer = lw.accounts[0]
        const delegate = lw.accounts[2]

        const addParams = [receiver, delegate, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1]
        const transferParams = [receiver, 0, 0, 0, 0, 0]
        await addRecurringTransfer(addParams, signer)
        await executeRecurringTransfer(transferParams, delegate)

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - transferAmount, "expected safe balance to decrease after transfer")
        assert.equal(receiverEndBalance, receiverStartBalance + transferAmount, "expected receiver balance to increase after transfer")
    })

    it('should reject when rando tries to make transfer', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: transferAmount * 2})
        const safeStartBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverStartBalance = web3.eth.getBalance(receiver).toNumber()

        const signer = lw.accounts[0]
        const rando = lw.accounts[2]

        const addParams = [receiver, 0, 0, 0, transferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1]
        const transferParams = [receiver, 0, 0, 0, 0, 0]
        await addRecurringTransfer(addParams, signer)
        const transferSig = await signModuleTx(recurringTransfersModule, transferParams, lw, [rando])
        await utils.assertRejects(
            recurringTransfersModule.executeRecurringTransfer(...transferParams, transferSig, {from: owner}),
            'expected recurring transfer to get rejected'
        )

        const safeEndBalance = web3.eth.getBalance(gnosisSafe.address).toNumber()
        const receiverEndBalance = web3.eth.getBalance(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance, "expected safe balance to be the same after transfer")
        assert.equal(receiverEndBalance, receiverStartBalance, "expected receiver balance to be the same after transfer")
    })

    // fails
    it('should transfer adjusted value of ERC20 tokens', async () => {
        await web3.eth.sendTransaction({from: owner, to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        const tokenTransferAmount = 1e18
        const token1 = await createTestToken(owner, tokenTransferAmount)
        const token2Address = '0x1'
        await token1.transfer(gnosisSafe.address, tokenTransferAmount, {from: owner})
        const safeStartBalance = await token1.balances(gnosisSafe.address).toNumber()
        const receiverStartBalance = await token1.balances(receiver).toNumber()

        const signer = lw.accounts[0]
        const rando = accounts[7]

        // make sure there is no auction between tokens
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getAuctionIndex.getData(token1.address, token2Address),
            '0x' + abi.rawEncode(['uint'], [0]).toString('hex')
        )
        // mock token values
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(token1.address),
            '0x'+ abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 10e18.toFixed()]).toString('hex')
        )
        await mockDutchExchange.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(token2Address),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 200e18.toFixed()]).toString('hex')
        )

        const addParams = [receiver, 0, token1.address, token2Address, tokenTransferAmount, currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1]
        const transferParams = [receiver, 0, 0, 0, 0, 0]
        await addRecurringTransfer(addParams, signer)
        await executeRecurringTransfer(transferParams, signer)

        const safeEndBalance = await token1.balances(gnosisSafe.address).toNumber()
        const receiverEndBalance = await token1.balances(receiver).toNumber()

        assert.equal(safeEndBalance, safeStartBalance - (tokenTransferAmount / 20), "expected safe token balance to decrease after transfer")
        assert.equal(receiverEndBalance, receiverStartBalance + (tokenTransferAmount / 20), "expected receiver token balance to decrease after transfer")
    })

    const addRecurringTransfer = async (params, signer) => {
        const data = await recurringTransfersModule.contract.addRecurringTransfer.getData(...params)
        const nonce = await gnosisSafe.nonce()
        const transactionHash = await gnosisSafe.getTransactionHash(recurringTransfersModule.address, 0, data, CALL, 0, 0, 0, 0, 0, nonce)
        const sig = utils.signTransaction(lw, [signer], transactionHash)
        utils.logGasUsage(
            'add recurring transfer',
            await gnosisSafe.execTransaction(
                recurringTransfersModule.address, 0, data, CALL, 0, 0, 0, 0, 0, sig, {from: relayer}
            )
        )
    }

    const removeRecurringTransfer = async (params, signer) => {
        const data = await recurringTransfersModule.contract.removeRecurringTransfer.getData(...params)
        const nonce = await gnosisSafe.nonce()
        const transactionHash = await gnosisSafe.getTransactionHash(recurringTransfersModule.address, 0, data, CALL, 0, 0, 0, 0, 0, nonce)
        const sig = utils.signTransaction(lw, [signer], transactionHash)
        utils.logGasUsage(
            'remove recurring transfer',
            await gnosisSafe.execTransaction(
                recurringTransfersModule.address, 0, data, CALL, 0, 0, 0, 0, 0, sig, {from: relayer}
            )
        )
    }

    const executeRecurringTransfer = async (params, signer) => {
        const sig = await signModuleTx(recurringTransfersModule, params, lw, [signer])
        utils.logGasUsage(
            'execute recurring transfer',
            await recurringTransfersModule.executeRecurringTransfer(
                ...params, sig, {from: relayer}
            )
        )
    }
})

const signModuleTx = async (module, params, lw, signers) => {
    let nonce = await module.nonce()
    let txHash = await module.getTransactionHash(...params, nonce)
    let sig = utils.signTransaction(lw, signers, txHash)

    return sig
}

const createTestToken = async (creator, balance) => {
    let source = `
    contract TestToken {
        mapping (address => uint) public balances;
        constructor() public {
            balances[msg.sender] = ${balance.toFixed()};
        }
        function transfer(address to, uint value) public returns (bool) {
            require(balances[msg.sender] >= value);
            balances[msg.sender] -= value;
            balances[to] += value;
        }
    }`
    let output = await utils.compile(source);
    // Create test token contract
    let contractInterface = output.interface
    let contractBytecode = output.data
    let transactionHash = await web3.eth.sendTransaction({from: creator, data: contractBytecode, gas: 4000000})
    let receipt = web3.eth.getTransactionReceipt(transactionHash);
    const TestToken = web3.eth.contract(contractInterface)
    return TestToken.at(receipt.contractAddress)
}
