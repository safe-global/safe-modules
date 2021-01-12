const utils = require('@gnosis.pm/safe-contracts/test/utils/general')

const truffleContract = require("@truffle/contract")

const GnosisSafeBuildInfo = require("@gnosis.pm/safe-contracts/build/contracts/GnosisSafe.json")
const GnosisSafe = truffleContract(GnosisSafeBuildInfo)
GnosisSafe.setProvider(web3.currentProvider)
const GnosisSafeProxyBuildInfo = require("@gnosis.pm/safe-contracts/build/contracts/GnosisSafeProxy.json")
const GnosisSafeProxy = truffleContract(GnosisSafeProxyBuildInfo)
GnosisSafeProxy.setProvider(web3.currentProvider)

const BequestModule = artifacts.require("./BequestModule.sol")
const ERC20Wrapper = artifacts.require("./ERC20Wrapper.sol")
const TestToken = artifacts.require("./TestToken.sol")

const toBN = web3.utils.toBN

const expectThrowsAsync = async (method, errorMessage) => {
    let error = null
    try {
        await method()
    }
    catch (err) {
        error = err
    }
    expect(error).to.be.an('Error')
    if (errorMessage) {
        expect(error.message).to.equal(errorMessage)
    }
}

contract('BequestModule delegate', function(accounts) {
    let lw
    let gnosisSafe
    let safeModule

    const CALL = 0
    const ADDRESS_0 = "0x0000000000000000000000000000000000000000"

    beforeEach(async function() {
        // Create lightwallet
        lw = await utils.createLightwallet()

        // Create Master Copies
        let amodule = await BequestModule.deployed()
        console.log(amodule.address)
        safeModule = await BequestModule.new()

        const gnosisSafeMasterCopy = await GnosisSafe.new({ from: accounts[0] })
        const proxy = await GnosisSafeProxy.new(gnosisSafeMasterCopy.address, { from: accounts[0] })
        gnosisSafe = await GnosisSafe.at(proxy.address)
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1], accounts[1]], 2, ADDRESS_0, "0x", ADDRESS_0, ADDRESS_0, 0, ADDRESS_0, { from: accounts[0] })
    })

    let execTransaction = async function(to, value, data, operation, message) {
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        let result = await gnosisSafe.execTransaction(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, sigs, { from: accounts[0] })
        utils.logGasUsage(
            'execTransaction ' + message,
            result
        )
        return result
    }

    it('Execute bequest with delegate', async () => {
        const token = await TestToken.new({from: accounts[0]})
        await token.transfer(gnosisSafe.address, '1000', {from: accounts[0]}) 

        let wrapper = await ERC20Wrapper.new(safeModule.address, "http://example.com", {from: accounts[0]})

        let enableModuleData = await gnosisSafe.contract.methods.enableModule(safeModule.address).encodeABI()
        await execTransaction(gnosisSafe.address, 0, enableModuleData, CALL, "enable module")
        let modules = await gnosisSafe.getModules()
        assert.equal(1, modules.length)
        assert.equal(safeModule.address, modules[0])

        heir = accounts[1]

        let setup = await safeModule.contract.methods.setup(accounts[1], '1000').encodeABI()
        await execTransaction(safeModule.address, 0, setup, CALL, "setup")

        assert.equal(await safeModule.contract.methods.heir().call(), accounts[1])
        assert.equal(await safeModule.contract.methods.bequestDate().call(), '1000')

        await await wrapper.setApprovalForAll(wrapper.address, true, {from: heir})

        const big = toBN(2).pow(toBN(256)).sub(toBN(1))
        const approval2 = await token.contract.methods.approve(wrapper.address, big).encodeABI()
        await execTransaction(gnosisSafe.address, 0, approval2, CALL, "approval2")

        const Call = 0
        // const DelegateCall = 1

        assert.equal(await token.balanceOf(lw.accounts[3]), '0')
        let transfer = await wrapper.contract.methods.safeTransferFrom(
            gnosisSafe.address, lw.accounts[3], token.address, '10', []).encodeABI()
        await await safeModule.contract.methods.execute(wrapper.address, 0, transfer, Call).send({from: heir})
        assert.equal(await token.balanceOf(lw.accounts[3]), '10')
    })
})