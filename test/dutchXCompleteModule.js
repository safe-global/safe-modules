const utils = require('gnosis-safe/test/utils')

const CreateAndAddModules = artifacts.require("./CreateAndAddModules.sol");
const DutchXModule = artifacts.require("./DutchXCompleteModule.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const DutchXInterface = artifacts.require("./DutchXInterface.sol")
const TokenInterface = artifacts.require("./DutchXTokenInterface.sol")
const MockContract = artifacts.require("./MockContract.sol")


// Helper function to deploy a mocked tocken
let deployWETHToken = async function(deployer) {
    let tokenSource = `
    contract TestToken {
        constructor() public {}
        function transfer(address to, uint value) public returns (bool) {
            return true;
        }
        function approve(address spender, uint amount) public returns (bool){
            return true;
        }
        function deposit() public payable returns (bool){
            return true;
        }

        function withdraw() public returns (bool){
            return true;
        }
    }`
    let output = await utils.compile(tokenSource);
    let tokenInterface = output.interface
    let tokenBytecode = output.data
    let transactionHash = await web3.eth.sendTransaction({from: deployer, data: tokenBytecode, gas: 4000000})
    let receipt = web3.eth.getTransactionReceipt(transactionHash);
    const TestToken = web3.eth.contract(tokenInterface)
    return TestToken.at(receipt.contractAddress)
}

contract('DutchXModule', function(accounts) {

    let dxMock
    let token
    let gnosisSafe
    let dxModule
    let lw

    const CALL = 0

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()

        const mock = await MockContract.new()
        mock.givenAnyReturnBool(true)

        const tokenMock = await deployWETHToken(accounts[0])

        // Mocked contracts
        dxMock = DutchXInterface.at(mock.address)
        token = TokenInterface.at(tokenMock.address)

        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModules = await CreateAndAddModules.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        // Initialize safe master copy with accounts[0] and accounts[1] as owners and 2 required confirmations
        gnosisSafeMasterCopy.setup([accounts[0], accounts[1]], 2, 0, "0x")
        let dxModuleCopy = await DutchXModule.new( [])
        // Create Gnosis Safe and DutchX Module in one transaction
        let moduleData = await dxModuleCopy.contract.setup.getData(dxMock.address, [], [accounts[0]], 0) // dx, whitelistedToken, operators
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(dxModuleCopy.address, moduleData)
        let modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
        // Initialize safe proxy with lightwallet accounts as owners and also accounts[1], note that only lightwallet accounts can sign messages without prefix
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], accounts[1]], 2, createAndAddModules.address, createAndAddModulesData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and DutchX Module',
        )
        let modules = await gnosisSafe.getModules()
        dxModule = DutchXModule.at(modules[0])
        assert.equal(await dxModule.manager.call(), gnosisSafe.address)
    })

    it('before adding any token to whitelist, list should be empty', async () => {
        const initialWhitelistedTokens = await dxModule.getWhitelistedTokens()
        assert.equal(initialWhitelistedTokens.length, 0, "Initial whitelisted tokens should be none")
    })

    it('should execute approve tokens and deposit for whitelisted token in the dx', async () => {
        
        // send 1 ETH to the safe
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await (await web3.eth.getBalance(gnosisSafe.address)).toNumber(), web3.toWei(1, 'ether'));

        // safe contract has ETH, module is set up correctly, but none whitelisted token
        // if we try to execute any function, will fail, none token defined.
        // it doesn't need to have tokens in the safe because deposit is mocked, returns always true
        const depositWETHData = token.contract.deposit.getData()
        utils.assertRejects(
            dxModule.executeWhitelisted(
                token.address, web3.toWei(1, 'ether'), depositWETHData, {from: accounts[0]}
            ),
            'execTransactionFromModule deposit WETH fails'
        )
        
        // addWhitelist must come from the safe contract
        // regular tx from owner accounts will fail
        utils.assertRejects(
            dxModule.addToWhitelist(token.address, {from: accounts[0]}),
            'Whitelist token'
        )

        // from the safe works
        let data = await dxModule.contract.addToWhitelist.getData(token.address)
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(dxModule.address, 0, data, CALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'execTransaction add account to whitelist',
            await gnosisSafe.execTransaction(
                dxModule.address, 0, data, CALL, 0, 0, 0, 0, 0, sigs
            )
        )
        assert.equal(await dxModule.isWhitelistedToken(token.address), true)

        const newWhitelistedTokens = await dxModule.getWhitelistedTokens()
        assert.equal(newWhitelistedTokens.length, 1, "Whitelisted tokens should contain one")
        assert.equal(newWhitelistedTokens[0], token.address, "Whitelisted token should be the one passed to addToWhitelist")

        // No operator user will fail when trying to execute a transaction
        utils.assertRejects(
            dxModule.executeWhitelisted(token.address, web3.toWei(1, 'ether'), depositWETHData, {from: accounts[1]}),
            'no operator fail to execute from module'
        )

        utils.logGasUsage(
            'execTransactionFromModule deposit WETH',
            await dxModule.executeWhitelisted(
                token.address, web3.toWei(1, 'ether'), depositWETHData, {from: accounts[0]}
            )
        )

        // unknown operation shouldn't execute
        utils.assertRejects(
            dxModule.executeWhitelisted(token.address, 0, token.contract.withdraw.getData(), {from: accounts[0]}),
            'withdraw function is not whitelisted'
        )

        // approve only works if spender is the dx
        utils.assertRejects(
            dxModule.executeWhitelisted(token.address, 0, token.contract.approve.getData(token.address, 0), {from: accounts[0]}),
            'spender is not the dx'
        )

        utils.logGasUsage(
            'execTransactionFromModule approve dx',
            await dxModule.executeWhitelisted(token.address, 0, token.contract.approve.getData(dxMock.address, 0), {from: accounts[0]})
        )
    })

    it('should accept only dx functions that are whitelisted and with whitelisted tokens', async () => {

        // validate dx proxy is whitelited
        assert.equal(await dxModule.dutchXAddress(), dxMock.address)

        utils.assertRejects(
            dxModule.executeWhitelisted(
                dxMock.address, 0, dxMock.contract.withdraw.getData(), {from: accounts[0]}
            ),
            'execTransactionFromModule withdraw fails, it is not whitelited'
        )

        // claiming works
        const claimingBuyerData = dxMock.contract.claimTokensFromSeveralAuctionsAsBuyer.getData([], [], [], accounts[0])
        utils.logGasUsage(
            'execTransactionFromModule claimTokensFromSeveralAuctionsAsBuyer',
            await dxModule.executeWhitelisted(
                dxMock.address, 0, claimingBuyerData, {from: accounts[0]}
            )
        )

        const claimingSellerData = dxMock.contract.claimTokensFromSeveralAuctionsAsSeller.getData([], [], [], accounts[0])
        utils.logGasUsage(
            'execTransactionFromModule claimTokensFromSeveralAuctionsAsSeller',
            await dxModule.executeWhitelisted(
                dxMock.address, 0, claimingSellerData, {from: accounts[0]}
            )
        )

        // send 1 ETH to the safe
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await (await web3.eth.getBalance(gnosisSafe.address)).toNumber(), web3.toWei(1, 'ether'));

        // eth values is not allowed, only for deposit
        utils.assertRejects(            
            dxModule.executeWhitelisted(
                dxMock.address, web3.toWei(1, 'ether'), claimingSellerData, {from: accounts[0]}
            ),
            'execTransactionFromModule claimTokensFromSeveralAuctionsAsSeller fails due to ETH value',
        )

        // post buy and post sell fails if the token is not whitelisted
        // let's whitelist one
        let data = await dxModule.contract.addToWhitelist.getData(token.address)
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(dxModule.address, 0, data, CALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'execTransaction add account to whitelist',
            await gnosisSafe.execTransaction(
                dxModule.address, 0, data, CALL, 0, 0, 0, 0, 0, sigs
            )
        )
        assert.equal(await dxModule.isWhitelistedToken(token.address), true)

        const nonWhitelistedToken = accounts[2]
        const trivialAddress = accounts[3]
        const trivialAuctionIndex = 13

        const postBuyData1 = dxMock.contract.postBuyOrder.getData(token.address, nonWhitelistedToken, trivialAuctionIndex, 0)
        const postBuyData2 = dxMock.contract.postBuyOrder.getData(nonWhitelistedToken, token.address, trivialAuctionIndex, 0)
        // in both cases, accounts[0] is not whitelisted but token is
        utils.assertRejects(            
            dxModule.executeWhitelisted(
                dxMock.address, 0, postBuyData1, {from: accounts[0]}
            ),
            'execTransactionFromModule post buy order with buy token not whitelisted fails',
        )
        utils.assertRejects(            
            dxModule.executeWhitelisted(
                dxMock.address, 0, postBuyData2, {from: accounts[0]}
            ),
            'execTransactionFromModule post buy order with with sell token not whitelisted fails',
        )

        // if we try with both tokens whitelisted, it works
        const postBuyData3 = dxMock.contract.postBuyOrder.getData(token.address, token.address, trivialAuctionIndex, 0)
        
        utils.logGasUsage(            
            'execTransactionFromModule post buy order with both tokens whitelisted goes forward',
            await dxModule.executeWhitelisted(
                dxMock.address, 0, postBuyData3, {from: accounts[0]}
            )
        )

        // The same with post sell
        const postSellData1 = dxMock.contract.postSellOrder.getData(token.address, nonWhitelistedToken, trivialAuctionIndex, 0)
        const postSellData2 = dxMock.contract.postSellOrder.getData(nonWhitelistedToken, token.address, trivialAuctionIndex, 0)
        // in both cases, accounts[0] is not whitelisted but token is
        utils.assertRejects(            
            dxModule.executeWhitelisted(
                dxMock.address, 0, postSellData1, {from: accounts[0]}
            ),
            'execTransactionFromModule post sell order with buy token not whitelisted fails',
        )
        utils.assertRejects(            
            dxModule.executeWhitelisted(
                dxMock.address, 0, postSellData2, {from: accounts[0]}
            ),
            'execTransactionFromModule post sell order with with sell token not whitelisted fails',
        )

        // if we try with both tokens whitelisted, it works
        const postSellData3 = dxMock.contract.postSellOrder.getData(token.address, token.address, trivialAuctionIndex, 0)
        
        utils.logGasUsage(            
            'execTransactionFromModule post buy order with both tokens whitelisted goes forward',
            await dxModule.executeWhitelisted(
                dxMock.address, 0, postSellData3, {from: accounts[0]}
            )
        )

        // Deposit against the dx should only allow whitelisted tokens
        utils.assertRejects(            
            dxModule.executeWhitelisted(
                dxMock.address, 0, dxMock.contract.deposit.getData(nonWhitelistedToken, 0), {from: accounts[0]}
            ),
            'execTransactionFromModule deposit in the dx not whitelisted token fails',
        )

        utils.logGasUsage(            
            'execTransactionFromModule deposit in the dx whitelisted token',
            await dxModule.executeWhitelisted(
                dxMock.address, 0, dxMock.contract.deposit.getData(token.address, 0), {from: accounts[0]}
            )
        )
    })
});
