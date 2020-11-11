const utils = require('@gnosis.pm/safe-contracts/test/utils/general')

const truffleContract = require("@truffle/contract")

const GnosisSafeBuildInfo = require("@gnosis.pm/safe-contracts/build/contracts/GnosisSafe.json")
const GnosisSafe = truffleContract(GnosisSafeBuildInfo)
GnosisSafe.setProvider(web3.currentProvider)
const GnosisSafeProxyBuildInfo = require("@gnosis.pm/safe-contracts/build/contracts/GnosisSafeProxy.json")
const GnosisSafeProxy = truffleContract(GnosisSafeProxyBuildInfo)
GnosisSafeProxy.setProvider(web3.currentProvider)

const VaultLiquidationProtectionModule = artifacts.require("./VaultLiquidationProtectionModule.sol")
// const TestToken = artifacts.require("./TestToken.sol")

contract('VaultLiquidationProtectionModule', function(accounts) {
    let lw
    let gnosisSafe
    let safeModule

    const CALL = 0
    const ADDRESS_0 = "0x0000000000000000000000000000000000000000"

    beforeEach(async function() {
        // Create lightwallet
        lw = await utils.createLightwallet()

        // Create Master Copies        

        const gnosisSafeMasterCopy = await GnosisSafe.new({ from: accounts[0] })
        const proxy = await GnosisSafeProxy.new(gnosisSafeMasterCopy.address, { from: accounts[0] })
        gnosisSafe = await GnosisSafe.at(proxy.address)
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1], accounts[1]], 2, ADDRESS_0, "0x", ADDRESS_0, ADDRESS_0, 0, ADDRESS_0, { from: accounts[0] })

        // constructor params:
        // maker_vat_vault, cdp_owner, maker_dai_bridge, maker_collateral_token_bridge, maker_collateral_token_id, manager, operator
        // Maker addresses are not important because we are not testing the Integration but rather the "core" logic of the module
        // By default, if you send a tx with data to a EOA, it will succeed. The data is meaningless
        let wethTokenID = "0x4554482d4100000000000000000000000000000000000000000000000000"
        safeModule = await VaultLiquidationProtectionModule.new(accounts[9], accounts[9], accounts[9], accounts[9], wethTokenID, proxy.address, accounts[2])
    })

    let execTransaction = async function(to, value, data, operation, message) {
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'execTransaction ' + message,
            await gnosisSafe.execTransaction(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, sigs, { from: accounts[0] })
        )
    }

    it('Test permissions', async () => {

        // Module Execution before enabling the module should fail
        await utils.assertRejects(
            safeModule.increase_cdp_collateralisation(
                0, 0, {from: accounts[2]}
            ),
            'executeModuleBeforeEnabled'
        )

        let enableModuleData = await gnosisSafe.contract.methods.enableModule(safeModule.address).encodeABI()
        await execTransaction(gnosisSafe.address, 0, enableModuleData, CALL, "enable module")
        let modules = await gnosisSafe.getModules()
        assert.equal(1, modules.length)
        assert.equal(safeModule.address, modules[0])

        // Module Execution after enabling the module should work for valid amounts only and when called by the operator account
        await utils.assertRejects(
            safeModule.increase_cdp_collateralisation(
                0, 0
            ),
            'onlyOperatorCanCallModule'
        )

        await safeModule.increase_cdp_collateralisation(
            0, 0, {from: accounts[2]}
        )

        // Deposits must increase cdp protection
        await utils.assertRejects(
            safeModule.increase_cdp_collateralisation(
                -1, 0
            ),
            'depositNegativeWETH'
        )

        await utils.assertRejects(
            safeModule.increase_cdp_collateralisation(
                0, 1
            ),
            'depositGenerateDAI'
        )

        await utils.assertRejects(
            safeModule.increase_cdp_collateralisation(
                -1, 1
            ),
            'depositForbiddenAmounts'
        )

        // allowed amounts
        await safeModule.increase_cdp_collateralisation(
            0, 0, {from: accounts[2]}
        )

        await safeModule.increase_cdp_collateralisation(
            1, 0, {from: accounts[2]}
        )

        await safeModule.increase_cdp_collateralisation(
            0, -1, {from: accounts[2]}
        )

        await safeModule.increase_cdp_collateralisation(
            1, -1, {from: accounts[2]}
        )
    
    })

    
})