const safeUtils = require('gnosis-safe/test/utils')
const BigNumber = require('bignumber.js')
const { wait } = require('@digix/tempo')(web3)
const utils = require('./utils')

const TransferLimitModule = artifacts.require("./modules/TransferLimitModule.sol")
const TransferLimitModuleMock = artifacts.require('./mocks/TransferLimitModuleMock.sol')
const MockContract = artifacts.require('./MockContract.sol')


contract('TransferLimitModule setup', (accounts) => {
    let lw

    beforeEach(async () => {
        // Create lightwallet
        lw = await safeUtils.createLightwallet()
    })

    it('should validate time period', async () => {
        assert(await utils.reverts(utils.setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0], [100], 60 * 59, false, 0, 0, 2, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )), 'expected tx to revert')
    })

    it('should validate threshold', async () => {
        assert(await utils.reverts(utils.setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0], [100], 24 * 60 * 60, false, 0, 0, 0, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )), 'expected tx to revert')

        assert(await utils.reverts(utils.setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0], [100], 24 * 60 * 60, false, 0, 0, 3, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )), 'expected tx to revert')
    })
})

contract('TransferLimitModule authorization', (accounts) => {
    let safe
    let module
    let lw
    let safeOwners

    beforeEach(async () => {
        // Create lightwallet
        lw = await safeUtils.createLightwallet()

        safeOwners = [lw.accounts[0], lw.accounts[1], lw.accounts[2], lw.accounts[3], accounts[0]]
        let res = await utils.setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0], [100], 60 * 60 * 24, false, 0, 0, 2, 0, accounts[1]],
            safeOwners,
            4
        )
        safe = res[0]
        module = res[1]
        assert.equal(await module.manager.call(), safe.address)
        assert.equal(await web3.eth.getBalance(safe.address).toNumber(), web3.toWei(1, 'ether'))
    })

    it('should withdraw only when authorized', async () => {
        let params = [0, accounts[0], 50, 0, 0, 0]
        let sigs = await utils.signModuleTx(module, params, lw, [lw.accounts[0]])

        // Withdrawal should fail for only one signature
        await safeUtils.assertRejects(
            module.executeTransferLimit(...params, sigs, { from: accounts[0] }),
            'signature threshold not met'
        )

        sigs = await utils.signModuleTx(module, params, lw, [lw.accounts[0], lw.accounts[1]])
        // Withdraw transfer limit
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let spent = (await module.transferLimits.call(0))[1]
        assert(spent.eq(50), 'spent value should be updated')
    })

    it('should allow withdrawal for delegate', async () => {
        await utils.updateDelegate(safe, module, lw, safeOwners.slice(0, 4), lw.accounts[4])
        let delegate = await module.delegate.call()
        assert.equal(delegate, lw.accounts[4])

        let params = [0, accounts[0], 50, 0, 0, 0]
        let sigs = await utils.signModuleTx(module, params, lw, [lw.accounts[4]])

        // Withdrawal should fail for only one signature by delegate
        await safeUtils.assertRejects(
            module.executeTransferLimit(...params, sigs, { from: accounts[0] }),
            'signature threshold not met'
        )

        sigs = await utils.signModuleTx(module, params, lw, [lw.accounts[0], lw.accounts[4]])
        // Withdraw transfer limit
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let spent = (await module.transferLimits.call(0))[1]
        assert(spent.eq(50), 'spent value should be updated')
    })

    it('should update threshold', async () => {
        await utils.updateThreshold(safe, module, lw, safeOwners.slice(0, 4), 3)
        let threshold = await module.threshold.call()
        assert.equal(threshold, 3)

        let params = [0, accounts[0], 50, 0, 0, 0]
        let sigs = await utils.signModuleTx(module, params, lw, [lw.accounts[0], lw.accounts[1]])

        // Withdrawal should fail for two signatures (previous threshold)
        await safeUtils.assertRejects(
            module.executeTransferLimit(...params, sigs, { from: accounts[0] }),
            'signature threshold not met'
        )

        sigs = await utils.signModuleTx(module, params, lw, [lw.accounts[0], lw.accounts[1], lw.accounts[2]])
        // Withdraw transfer limit
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let spent = (await module.transferLimits.call(0))[1]
        assert(spent.eq(50), 'spent value should be updated')
    })
})

contract('TransferLimitModule transfer limits', (accounts) => {
    let safe
    let module
    let lw
    let token
    let dutchx

    beforeEach(async () => {
        lw = await safeUtils.createLightwallet()

        // Mock token that always transfers successfully
        token = await utils.mockToken()

        // Mock DutchExchange
        dutchx = await utils.mockDutchx()

        let res = await utils.setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0, token.address], [100, 200], 60 * 60 * 24, false, 150, 0, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]
    })

    it('should withdraw ether within transfer limit', async () => {
        let params = [0, accounts[0], 50, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)

        // Withdraw transfer limit
        safeUtils.logGasUsage(
            'executeTransferLimit withdraw transfer limit',
            await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        )
    })

    it('should not withdraw ether more than limit', async () => {
        let params = [0, accounts[0], 150, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)

        assert(
            await utils.reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for over withdraw'
        )
    })

    it('should withdraw token within transfer limit', async () => {
        let params = [token.address, accounts[0], 50, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)

        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let spent = (await module.transferLimits.call(token.address))[1]
        assert(spent.eq(50), 'transfer is reflected in token expenditure')
    })

    it('should not withdraw token more than limit', async () => {
        let params = [token.address, accounts[0], 250, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)

        assert(
            await utils.reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for token over withdraw'
        )
    })

    it('should withdraw within global ether limit', async () => {
        let params = [0, accounts[0], 70, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })

        let weiSpent = (await module.transferLimits.call(0))[1]
        assert(weiSpent.eq(70), 'transfer is reflected in ether expenditure')
        let totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(70), 'total ether spent takes token transfer into account')

        params = [token.address, accounts[0], 70, 0, 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })

        let tokenSpent = (await module.transferLimits.call(token.address))[1]
        assert(tokenSpent.eq(70), 'transfer is reflected in token expenditure')
        totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(140), 'total wei spent is updated after transfers')
    })

    it('should not withdraw token more than global ether limit', async () => {
        let params = [token.address, accounts[0], 70, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })

        params = [0, accounts[0], 90, 0, 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)
        assert(
            await utils.reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for token over withdraw'
        )
    })
})

contract('TransferLimitModule global dai transfer limit', (accounts) => {
    let safe
    let module
    let lw
    let token
    let dutchx

    beforeEach(async () => {
        lw = await safeUtils.createLightwallet()
        token = await utils.mockToken()
        dutchx = await utils.mockDutchx()
        let res = await utils.setupModule(
            TransferLimitModuleMock,
            lw,
            accounts,
            [[0, token.address], [100, 200], 60 * 60 * 24, false, 0, 170, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]

        // Set mocked dai price
        await module.setPrice(utils.ethToWei.toString())
    })

    it('should withdraw token within global dai limit', async () => {
        let params = [0, accounts[0], 90, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let daiSpent = await module.totalDaiSpent.call()
        assert(daiSpent.eq(90), 'dai expenditure is updated after transfer')

        params = [token.address, accounts[0], 70, 0, 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        daiSpent = await module.totalDaiSpent.call()
        assert(daiSpent.eq(160), 'dai expenditure is updated after transfer')
    })

    it('should not withdraw more than global dai limit', async () => {
        let params = [token.address, accounts[0], 180, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)

        assert(
            await utils.reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for token over withdraw'
        )
    })
})

contract('TransferLimitModule time period', (accounts) => {
    let safe
    let module
    let lw
    let token
    let dutchx
    const timePeriod = 60 * 60 * 24

    beforeEach(async () => {
        lw = await safeUtils.createLightwallet()
        token = await utils.mockToken()
        dutchx = await utils.mockDutchx()
        let res = await utils.setupModule(
            TransferLimitModuleMock,
            lw,
            accounts,
            [[0, token.address], [100, 200], timePeriod, false, 150, 0, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]
    })

    it('should reset expenditure after period is over', async () => {
        // Set "now" to 1 min after beginning of next time period.
        let now = Date.now()
        let target = (now - (now % timePeriod)) + (timePeriod + 60)
        await wait(target)

        let params = [0, accounts[0], 70, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(70), 'total wei spent is updated after transfer')

        // Fast forward one hour
        await wait(60 * 60)

        params = [token.address, accounts[0], 70, 0, 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(140), 'total wei spent is updated after transfer')

        // Fast forward one hour
        await wait(60 * 60)

        params = [token.address, accounts[0], 30, 0, 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)
        // Should fail as limit will be exceeded
        assert(
            await utils.reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'expected tx to revert when limit is exceeded'
        )

        // Fast forward one day
        await wait(timePeriod)

        params = [token.address, accounts[0], 140, 0, 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(140), 'total wei spent is reset and updated after one day')
    })
})

contract('TransferLimitModule rolling time period', (accounts) => {
    let safe
    let module
    let lw
    let token
    let dutchx
    const timePeriod = 60 * 60 * 24

    beforeEach(async () => {
        lw = await safeUtils.createLightwallet()
        token = await utils.mockToken()
        dutchx = await utils.mockDutchx()
        let res = await utils.setupModule(
            TransferLimitModuleMock,
            lw,
            accounts,
            [[0, token.address], [100, 200], 60 * 60 * 24, true, 150, 0, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]
    })

    it('should reset expenditure after rolling period is over', async () => {
        let now = Date.now()
        let target = (now - (now % timePeriod)) + (timePeriod + 60)
        await wait(target)

        let params = [0, accounts[0], 70, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(70), 'total wei spent is updated after transfer')

        // Fast forward one hour
        await wait(60 * 60)

        params = [token.address, accounts[0], 70, 0, 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(140), 'total wei spent is updated after transfer')

        // Fast forward one hour
        await wait(60 * 60)

        params = [token.address, accounts[0], 30, 0, 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)
        // Should fail as limit will be exceeded
        assert(
            await utils.reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'expected tx to revert when limit is exceeded'
        )

        // Fast forward one day
        await wait(timePeriod)

        params = [token.address, accounts[0], 140, 0, 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(140), 'total wei spent is updated after transfer')
    })
})

contract('TransferLimitModule gas refund', (accounts) => {
    let safe
    let module
    let lw
    let token
    let failingToken
    let dutchx
    let relayer = accounts[1]

    beforeEach(async () => {
        lw = await safeUtils.createLightwallet()

        token = await utils.mockToken()

        failingToken = await MockContract.new()
        await failingToken.givenAnyRevert()

        // Mock DutchExchange
        dutchx = await utils.mockDutchx()

        let res = await utils.setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0, token.address, failingToken.address], [web3.toWei('500000', 'gwei'), 200, 20], 60 * 60 * 24, false, 0, 0, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]
    })

    it('should refund relayer with ether according to gasLimit', async () => {
        // Estimate gas usage
        let gasPrice = new BigNumber(10 ** 9) // 1 Gwei
        let params = [0, accounts[2], 50, gasPrice, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)
        let gasEstimate = await module.executeTransferLimit.estimateGas(...params, sigs, { from: relayer, gasPrice: 10 ** 9 })

        // Calculate gasLimit based on estimate
        let gasLimit = (new BigNumber(gasEstimate)).add(5000)
        params = [0, accounts[2], 50, gasLimit.mul(gasPrice), 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)

        let balance = await web3.eth.getBalance(relayer)
        let tx = await module.executeTransferLimit(...params, sigs, { from: relayer, gasPrice: gasPrice })
        let gasUsed = gasPrice.mul(tx.receipt.gasUsed)
        let gasRefundAmount = gasLimit.mul(gasPrice)
        let newBalance = await web3.eth.getBalance(relayer)
        assert(newBalance.eq(balance.sub(gasUsed).add(gasRefundAmount)), 'relayer should be refunded')
    })

    it('should refund relayer with token', async () => {
        let balance = await web3.eth.getBalance(relayer)
        let gasLimit = new BigNumber(10)
        let gasPrice = new BigNumber(1)
        let params = [0, accounts[2], 50, gasLimit.mul(gasPrice), token.address, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)

        let tx = await module.executeTransferLimit(...params, sigs, { from: relayer, gasPrice: 10 ** 9 })
        let gasUsed = (new BigNumber(10 ** 9)).mul(tx.receipt.gasUsed)
        let newBalance = await web3.eth.getBalance(relayer)
        assert(newBalance.eq(balance.sub(gasUsed)), 'relayer should have paid gasUsed')

        let spent = (await module.transferLimits.call(token.address))[1]
        assert(spent.eq(10), 'gas refund must be reflected in spent tokens')
    })

    it('should fail if refund exceeds transfer limits', async () => {
        let gasPrice = new BigNumber(10 ** 9) // 1 Gwei
        let params = [0, accounts[2], 50, gasPrice, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)
        let gasEstimate = await module.executeTransferLimit.estimateGas(...params, sigs, { from: relayer, gasPrice: 10 ** 9 })

        let gasLimit = (new BigNumber(gasEstimate)).add(5000)
        let amount = web3.toWei('400000', 'gwei')
        params = [0, accounts[2], amount, gasLimit.mul(gasPrice), 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)

        assert(
            await utils.reverts(module.executeTransferLimit(...params, sigs, { from: relayer, gasPrice })),
            'expected tx to revert when gas refund exceeds limit'
        )
    })

    it('should refund even when token transfer fails', async () => {
        // Estimate gas usage
        let gasPrice = new BigNumber(10 ** 9) // 1 Gwei
        let params = [failingToken.address, accounts[2], 5, gasPrice, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)
        let gasEstimate = await module.executeTransferLimit.estimateGas(...params, sigs, { from: relayer, gasPrice: 10 ** 9 })

        // Calculate gasLimit based on estimate
        let gasLimit = (new BigNumber(gasEstimate)).add(5000)
        params = [failingToken.address, accounts[2], 5, gasLimit.mul(gasPrice), 0, 0]
        sigs = await utils.signModuleTx(module, params, lw, signers)

        let balance = await web3.eth.getBalance(relayer)
        let tx = await module.executeTransferLimit(...params, sigs, { from: relayer, gasPrice: gasPrice })
        assert(tx.logs[0].event === 'TransferFailed', 'transfer should have failed')

        let spent = (await module.transferLimits.call(failingToken.address))[1]
        assert(spent.eq(0), 'token should not be spent')

        let gasUsed = gasPrice.mul(tx.receipt.gasUsed)
        let gasRefundAmount = gasLimit.mul(gasPrice)
        let newBalance = await web3.eth.getBalance(relayer)
        assert(newBalance.eq(balance.sub(gasUsed).add(gasRefundAmount)), 'relayer should be refunded')
    })

    it('should refund with tokens even when ether transfer fails', async () => {
        let res = await utils.setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0, token.address, failingToken.address], [web3.toWei('500000', 'gwei'), 200, 20], 60 * 60 * 24, false, 0, 0, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3,
            0 // No ether in safe
        )
        safe = res[0]
        module = res[1]

        let balance = await web3.eth.getBalance(relayer)
        let gasLimit = new BigNumber(10)
        let gasPrice = new BigNumber(1)
        let params = [0, accounts[2], 50, gasLimit.mul(gasPrice), token.address, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await utils.signModuleTx(module, params, lw, signers)

        await token.reset()
        let tx = await module.executeTransferLimit(...params, sigs, { from: relayer, gasPrice: 10 ** 9 })
        assert.equal(tx.logs[0].event, 'TransferFailed', 'transfer should have failed')

        let gasUsed = (new BigNumber(10 ** 9)).mul(tx.receipt.gasUsed)
        let newBalance = await web3.eth.getBalance(relayer)
        assert(newBalance.eq(balance.sub(gasUsed)), 'relayer should have paid gasUsed')

        let spent = (await module.transferLimits.call(token.address))[1]
        assert(spent.eq(10), 'gas refund must be reflected in spent tokens')

        let transferMethod = web3.sha3('transfer(address,uint256)').slice(0, 10)
        let invocationCount = await token.invocationCountForMethod.call(transferMethod)
        assert.equal(invocationCount, 1, 'transfer should have been called for token mock')
    })
})
