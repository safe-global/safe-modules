const utils = require('@gnosis.pm/safe-contracts/test/utils/general')
const { wait, waitUntilBlock } = require('./utils')(web3);

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const AllowanceModule = artifacts.require("./AllowanceModule.sol")
const TestToken = artifacts.require("./TestToken.sol")

contract('AllowanceModule', function(accounts) {
    let lw
    let gnosisSafe
    let safeModule

    const CALL = 0
    const ADDRESS_0 = "0x0000000000000000000000000000000000000000"

    beforeEach(async function() {
        // Create lightwallet
        lw = await utils.createLightwallet()

        // Create Master Copies
        gnosisSafe = await GnosisSafe.new()
        safeModule = await AllowanceModule.new()
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1], accounts[1]], 2, ADDRESS_0, "0x", ADDRESS_0, ADDRESS_0, 0, ADDRESS_0)
    })

    let currentMinutes = function() {
        return Math.floor(Date.now() / (1000 * 60))
    }

    let calculateResetTime = function(baseTime, resetTime) {
        let cM = currentMinutes()
        return cM - (cM - baseTime) % resetTime
    }

    let execTransaction = async function(to, value, data, operation, message) {
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'execTransaction ' + message,
            await gnosisSafe.execTransaction(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, sigs)
        )
    }

    it.only('Execute allowance without refund', async () => {
        const token = await TestToken.new({from: accounts[0]})
        await token.transfer(gnosisSafe.address, 1000, {from: accounts[0]}) 
        //const mintToken = await TestCompound.new(sourceToken.address)
        
        let enableModuleData = await gnosisSafe.contract.methods.enableModule(safeModule.address).encodeABI()
        await execTransaction(gnosisSafe.address, 0, enableModuleData, CALL, "enable module")
        let modules = await gnosisSafe.getModules()
        assert.equal(1, modules.length)
        assert.equal(safeModule.address, modules[0])

        let addDelegateData = await safeModule.contract.methods.addDelegate(lw.accounts[4]).encodeABI()
        await execTransaction(safeModule.address, 0, addDelegateData, CALL, "add delegate")

        let delegates = await safeModule.getDelegates(gnosisSafe.address, 0, 10)
        assert.equal(1, delegates.results.length)
        assert.equal(lw.accounts[4], delegates.results[0].toLowerCase())

        let startTime = currentMinutes() - 30
        let setAllowanceData = await safeModule.contract.methods.setAllowance(lw.accounts[4], token.address, 100, 60 * 24, startTime).encodeABI()
        await execTransaction(safeModule.address, 0, setAllowanceData, CALL, "set allowance")

        let tokens = await safeModule.getTokens(gnosisSafe.address, lw.accounts[4])
        assert.equal(1, tokens.length)
        assert.equal(token.address, tokens[0])
        let allowance = await safeModule.getTokenAllowance(gnosisSafe.address, lw.accounts[4], token.address)
        let startResetTime = calculateResetTime(startTime, 24 * 60)
        assert.equal(100, allowance[0])
        assert.equal(0, allowance[1])
        assert.equal(24 * 60, allowance[2])
        assert.equal(startResetTime, allowance[3])
        assert.equal(1, allowance[4])

        assert.equal(1000, await token.balanceOf(gnosisSafe.address))
        assert.equal(0, await token.balanceOf(accounts[1]))

        let nonce = allowance[4]
        let transferHash = await safeModule.generateTransferHash(
            gnosisSafe.address, token.address, accounts[1], 60, ADDRESS_0, 0, nonce
        )
        let signature = utils.signTransaction(lw, [lw.accounts[4]], transferHash)

        utils.logGasUsage(
            'executeAllowanceTransfer',
            await safeModule.executeAllowanceTransfer(
                gnosisSafe.address, token.address, accounts[1], 60, ADDRESS_0, 0, lw.accounts[4], signature
            )
        )

        assert.equal(940, await token.balanceOf(gnosisSafe.address))
        assert.equal(60, await token.balanceOf(accounts[1]))

        allowance = await safeModule.getTokenAllowance(gnosisSafe.address, lw.accounts[4], token.address)
        assert.equal(100, allowance[0])
        assert.equal(60, allowance[1])
        assert.equal(24 * 60, allowance[2])
        assert.equal(startResetTime, allowance[3])
        assert.equal(2, allowance[4])

        // Check that it fails over limit
        nonce = allowance[4]
        transferHash = await safeModule.generateTransferHash(
            gnosisSafe.address, token.address, accounts[1], 45, ADDRESS_0, 0, nonce
        )
        signature = utils.signTransaction(lw, [lw.accounts[4]], transferHash)
        utils.assertRejects(
            safeModule.executeAllowanceTransfer(
                gnosisSafe.address, token.address, accounts[1], 45, ADDRESS_0, 0, lw.accounts[4], signature
            ), 
            "Should not allow if over the limit"
        )
        await wait(12*60*60)
        transferHash = await safeModule.generateTransferHash(
            gnosisSafe.address, token.address, accounts[1], 40, ADDRESS_0, 0, nonce
        )
        signature = utils.signTransaction(lw, [lw.accounts[4]], transferHash)
        utils.logGasUsage(
            'executeAllowanceTransfer',
            await safeModule.executeAllowanceTransfer(
                gnosisSafe.address, token.address, accounts[1], 40, ADDRESS_0, 0, lw.accounts[4], signature
            )
        )
        assert.equal(900, await token.balanceOf(gnosisSafe.address))
        assert.equal(100, await token.balanceOf(accounts[1]))

        allowance = await safeModule.getTokenAllowance(gnosisSafe.address, lw.accounts[4], token.address)
        assert.equal(100, allowance[0])
        assert.equal(100, allowance[1])
        assert.equal(24 * 60, allowance[2])
        assert.equal(startResetTime, allowance[3])
        assert.equal(3, allowance[4])

        // Offset time by 45 min to check that limit is set in specified interval
        await wait(12*60*60 + 45*60)
        nonce = allowance[4]
        transferHash = await safeModule.generateTransferHash(
            gnosisSafe.address, token.address, accounts[1], 45, ADDRESS_0, 0, nonce
        )
        signature = utils.signTransaction(lw, [lw.accounts[4]], transferHash)
        utils.logGasUsage(
            'executeAllowanceTransfer',
            await safeModule.executeAllowanceTransfer(
                gnosisSafe.address, token.address, accounts[1], 45, ADDRESS_0, 0, lw.accounts[4], signature
            )
        )
        assert.equal(855, await token.balanceOf(gnosisSafe.address))
        assert.equal(145, await token.balanceOf(accounts[1]))

        allowance = await safeModule.getTokenAllowance(gnosisSafe.address, lw.accounts[4], token.address)
        assert.equal(100, allowance[0])
        assert.equal(45, allowance[1])
        assert.equal(24 * 60, allowance[2])
        assert.equal(startResetTime + 24 * 60, allowance[3])
        assert.equal(4, allowance[4])
    })
})