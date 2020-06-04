const utils = require('@gnosis.pm/safe-contracts/test/utils/general')
const abi = require("ethereumjs-abi")
const ethUtil = require('ethereumjs-util')

const MultiSend = artifacts.require("./MultiSend.sol")
const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const WhitelistModule = artifacts.require("./WhitelistModule.sol");


contract('WhitelistModule', function(accounts) {

    let gnosisSafe
    let whitelistModule
    let lw

    const CALL = 0
    const DELEGATECALL = 1

    let encodeData = function(operation, to, value, data) {
        let dataBuffer = Buffer.from(ethUtil.stripHexPrefix(data), "hex")
        let encoded = abi.solidityPack(["uint8", "address", "uint256", "uint256", "bytes"], [operation, to, value, dataBuffer.length, dataBuffer])
        return encoded.toString("hex")
    }

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let multiSend = await MultiSend.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        let whitelistModuleMasterCopy = await WhitelistModule.new()
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], accounts[1]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()
        gnosisSafe = await utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe',
        )
        // Setup whitelist module

        const proxyCreationCode = await proxyFactory.proxyCreationCode()
        const saltNonce = Date.now()
        const encodedNonce = abi.rawEncode(['uint256'], [saltNonce]).toString('hex')
        const constructorData = abi.rawEncode(['address'],[ whitelistModuleMasterCopy.address]).toString('hex')
        const predictedModuleAddress = "0x" + ethUtil.generateAddress2(
            proxyFactory.address, 
            ethUtil.keccak256("0x" + ethUtil.keccak256("0x").toString("hex") + encodedNonce), 
            proxyCreationCode + constructorData
        ).toString("hex")
        console.log({predictedModuleAddress})
        // We do not init the module on proxy creation (msg.sender would be wrong)
        let proxyFactoryData = await proxyFactory.contract.methods.createProxyWithNonce(whitelistModuleMasterCopy.address, "0x", saltNonce).encodeABI()
        // Init module separately
        let setupModuleData = await whitelistModuleMasterCopy.contract.methods.setup([accounts[3]]).encodeABI()
        // Enable module
        let enableModuleData = await gnosisSafeMasterCopy.contract.methods.enableModule(predictedModuleAddress).encodeABI()

        // Encode txs
        let nestedTransactionData = '0x' +
            encodeData(0, proxyFactory.address, 0, proxyFactoryData) +
            encodeData(0, predictedModuleAddress, 0, setupModuleData) +
            encodeData(0, gnosisSafe.address, 0, enableModuleData)
        console.log({nestedTransactionData})
        let data = await multiSend.contract.methods.multiSend(nestedTransactionData).encodeABI()
        // Trigger txs
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, utils.Address0, utils.Address0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'execTransaction send multiple transactions',
            await gnosisSafe.execTransaction(
                multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, utils.Address0, utils.Address0, sigs
            )
        )

        let modules = await gnosisSafe.getModules()
        console.log({modules})
        whitelistModule = await WhitelistModule.at(modules[0])
        assert.equal(await whitelistModule.manager.call(), gnosisSafe.address)
    })

    it('should execute a withdraw transaction to a whitelisted account', async () => {
        // Withdraw to whitelisted account should fail as we don't have funds
        await utils.assertRejects(
            whitelistModule.executeWhitelisted(
                accounts[3], 300, "0x", {from: accounts[1]}
            ),
            "Not enough funds"
        )
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("1", 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("1", 'ether'));
        // Withdraw to whitelisted account
        utils.logGasUsage(
            'execTransactionFromModule withdraw to whitelisted account',
            await whitelistModule.executeWhitelisted(
                accounts[3], 300, "0x", {from: accounts[1]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("1", 'ether') - 300);
    })

    it('should add and remove an account from the whitelist', async () => {
        assert.equal(await whitelistModule.isWhitelisted(accounts[1]), false)
        // Add account 3 to whitelist
        let data = await whitelistModule.contract.methods.addToWhitelist(accounts[1]).encodeABI()
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(whitelistModule.address, 0, data, CALL, 0, 0, 0, utils.Address0, utils.Address0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'execTransaction add account to whitelist',
            await gnosisSafe.execTransaction(
                whitelistModule.address, 0, data, CALL, 0, 0, 0, utils.Address0, utils.Address0, sigs
            )
        )
        assert.equal(await whitelistModule.isWhitelisted(accounts[1]), true)
        // Remove account 3 from whitelist
        data = await whitelistModule.contract.methods.removeFromWhitelist(accounts[1]).encodeABI()
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getTransactionHash(whitelistModule.address, 0, data, CALL, 0, 0, 0, utils.Address0, utils.Address0, nonce)
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'execTransaction remove account from whitelist',
            await gnosisSafe.execTransaction(
                whitelistModule.address, 0, data, CALL, 0, 0, 0, utils.Address0, utils.Address0, sigs
            )
        )
        assert.equal(await whitelistModule.isWhitelisted(accounts[1]), false)
    })
});
