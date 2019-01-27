const ABI = require('ethereumjs-abi')
const BigNumber = require('bignumber.js')
const safeUtils = require('gnosis-safe/test/utils')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const MockContract = artifacts.require('./MockContract.sol')
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol")

const CALL = 0
const ethToWei = (new BigNumber(10)).pow(18)

const reverts = (p) => new Promise((resolve) => p.then(() => resolve(false)).catch((e) => resolve(e.message.search('revert') >= 0)))

const signModuleTx = async (module, params, lw, signers) => {
    let nonce = await module.nonce()
    let txHash = await module.getTransactionHash(...params, nonce)
    let sigs = safeUtils.signTransaction(lw, signers, txHash)

    return sigs
}

const execSafeTx = async (safe, module, lw, keys, data) => {
    let nonce = await safe.nonce()
    let transactionHash = await safe.getTransactionHash(module.address, 0, data, CALL, 100000, 0, web3.toWei(100, 'gwei'), 0, 0, nonce)
    let sigs = safeUtils.signTransaction(lw, keys, transactionHash)

    await safe.execTransaction(
        module.address, 0, data, CALL, 100000, 0, web3.toWei(100, 'gwei'), 0, 0, sigs
    )
}

const updateDelegate = async (safe, module, lw, keys, delegate) => {
    let data = await module.contract.setDelegate.getData(delegate)
    await execSafeTx(safe, module, lw, keys, data)
}

const updateThreshold = async (safe, module, lw, keys, threshold) => {
    let data = await module.contract.setThreshold.getData(threshold)
    await execSafeTx(safe, module, lw, keys, data)
}

const mockToken = async () => {
    let token = await MockContract.new()
    await token.givenAnyReturnBool(true)
    return token
}

const mockDutchx = async () => {
    let dutchx = await MockContract.new()
    // Each token costs 1 Wei.
    await dutchx.givenMethodReturn(
        web3.sha3('getPriceOfTokenInLastAuction(address)').slice(0, 10),
        '0x' + ABI.rawEncode(['uint256', 'uint256'], [1, ethToWei.toString()]).toString('hex')
    )
    return dutchx
}

const setupModule = async (moduleContract, lw, accounts, params, safeOwners, safeThreshold, safeBalance = web3.toWei(1, 'ether')) => {
    // Create Master Copies
    let proxyFactory = await ProxyFactory.new()
    let createAndAddModules = await CreateAndAddModules.new()
    let gnosisSafeMasterCopy = await GnosisSafe.new()

    let moduleMasterCopy = await moduleContract.new()
    let moduleData = await moduleMasterCopy.contract.setup.getData(...params)
    let proxyFactoryData = await proxyFactory.contract.createProxy.getData(moduleMasterCopy.address, moduleData)
    let modulesCreationData = safeUtils.createAndAddModulesData([proxyFactoryData])
    let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
    let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData(safeOwners, safeThreshold, createAndAddModules.address, createAndAddModulesData)

    safe = safeUtils.getParamFromTxEvent(
        await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
        'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Transfer Limit Module',
    )
    let modules = await safe.getModules()
    module = moduleContract.at(modules[0])

    // Deposit 1 ether
    await web3.eth.sendTransaction({ from: accounts[0], to: safe.address, value: safeBalance })

    return [ safe, module ]
}

module.exports = {
    reverts,
    signModuleTx,
    updateDelegate,
    updateThreshold,
    mockToken,
    mockDutchx,
    setupModule,
    ethToWei
}
