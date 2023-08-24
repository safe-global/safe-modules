const utils = require('@gnosis.pm/safe-contracts/test/utils/general')

const truffleContract = require('@truffle/contract')

const GnosisSafeBuildInfo = require('@gnosis.pm/safe-contracts/build/contracts/GnosisSafe.json')
const GnosisSafe = truffleContract(GnosisSafeBuildInfo)
GnosisSafe.setProvider(web3.currentProvider)
const GnosisSafeProxyBuildInfo = require('@gnosis.pm/safe-contracts/build/contracts/GnosisSafeProxy.json')
const GnosisSafeProxy = truffleContract(GnosisSafeProxyBuildInfo)
GnosisSafeProxy.setProvider(web3.currentProvider)

const AllowanceModule = artifacts.require('./AllowanceModule.sol')
const TestToken = artifacts.require('./TestToken.sol')
const { calculateAllowanceTransferHash } = require('./utils')(web3)

contract('AllowanceModule delegate', function (accounts) {
  let lw
  let gnosisSafe
  let safeModule

  const CALL = 0
  const ADDRESS_0 = '0x0000000000000000000000000000000000000000'

  beforeEach(async function () {
    // Create lightwallet
    lw = await utils.createLightwallet()

    // Create Master Copies
    safeModule = await AllowanceModule.new()

    const gnosisSafeMasterCopy = await GnosisSafe.new({ from: accounts[0] })
    const proxy = await GnosisSafeProxy.new(gnosisSafeMasterCopy.address, {
      from: accounts[0],
    })
    gnosisSafe = await GnosisSafe.at(proxy.address)
    await gnosisSafe.setup(
      [lw.accounts[0], lw.accounts[1], accounts[1]],
      2,
      ADDRESS_0,
      '0x',
      ADDRESS_0,
      ADDRESS_0,
      0,
      ADDRESS_0,
      { from: accounts[0] }
    )
  })

  let execTransaction = async function (to, value, data, operation, message) {
    let nonce = await gnosisSafe.nonce()
    let transactionHash = await gnosisSafe.getTransactionHash(
      to,
      value,
      data,
      operation,
      0,
      0,
      0,
      ADDRESS_0,
      ADDRESS_0,
      nonce
    )
    let sigs = utils.signTransaction(
      lw,
      [lw.accounts[0], lw.accounts[1]],
      transactionHash
    )
    utils.logGasUsage(
      'execTransaction ' + message,
      await gnosisSafe.execTransaction(
        to,
        value,
        data,
        operation,
        0,
        0,
        0,
        ADDRESS_0,
        ADDRESS_0,
        sigs,
        { from: accounts[0] }
      )
    )
  }

  it('Add delegates and remove first delegate', async () => {
    let enableModuleData = await gnosisSafe.contract.methods
      .enableModule(safeModule.address)
      .encodeABI()
    await execTransaction(
      gnosisSafe.address,
      0,
      enableModuleData,
      CALL,
      'enable module'
    )
    let modules = await gnosisSafe.getModules()
    assert.equal(1, modules.length)
    assert.equal(safeModule.address, modules[0])

    // Add delegates
    let addDelegateData = await safeModule.contract.methods
      .addDelegate(lw.accounts[4])
      .encodeABI()
    await execTransaction(
      safeModule.address,
      0,
      addDelegateData,
      CALL,
      'add delegate 1'
    )

    let addDelegateData2 = await safeModule.contract.methods
      .addDelegate(lw.accounts[5])
      .encodeABI()
    await execTransaction(
      safeModule.address,
      0,
      addDelegateData2,
      CALL,
      'add delegate 2'
    )

    let delegates = await safeModule.getDelegates(gnosisSafe.address, 0, 10)
    assert.equal(2, delegates.results.length)
    assert.equal(lw.accounts[5], delegates.results[0].toLowerCase())
    assert.equal(lw.accounts[4], delegates.results[1].toLowerCase())

    // Remove delegate
    let removeDelegateData = await safeModule.contract.methods
      .removeDelegate(lw.accounts[5], true)
      .encodeABI()
    await execTransaction(
      safeModule.address,
      0,
      removeDelegateData,
      CALL,
      'remove delegate 2'
    )
    delegates = await safeModule.getDelegates(gnosisSafe.address, 0, 10)
    assert.equal(1, delegates.results.length)
    assert.equal(lw.accounts[4], delegates.results[0].toLowerCase())
  })

  it('Add delegates and remove second delegate', async () => {
    let enableModuleData = await gnosisSafe.contract.methods
      .enableModule(safeModule.address)
      .encodeABI()
    await execTransaction(
      gnosisSafe.address,
      0,
      enableModuleData,
      CALL,
      'enable module'
    )
    let modules = await gnosisSafe.getModules()
    assert.equal(1, modules.length)
    assert.equal(safeModule.address, modules[0])

    // Add delegates
    let addDelegateData = await safeModule.contract.methods
      .addDelegate(lw.accounts[4])
      .encodeABI()
    await execTransaction(
      safeModule.address,
      0,
      addDelegateData,
      CALL,
      'add delegate 1'
    )

    let addDelegateData2 = await safeModule.contract.methods
      .addDelegate(lw.accounts[5])
      .encodeABI()
    await execTransaction(
      safeModule.address,
      0,
      addDelegateData2,
      CALL,
      'add delegate 2'
    )

    let delegates = await safeModule.getDelegates(gnosisSafe.address, 0, 10)
    assert.equal(2, delegates.results.length)
    assert.equal(lw.accounts[5], delegates.results[0].toLowerCase())
    assert.equal(lw.accounts[4], delegates.results[1].toLowerCase())

    // Remove delegate
    let removeDelegateData = await safeModule.contract.methods
      .removeDelegate(lw.accounts[4], true)
      .encodeABI()
    await execTransaction(
      safeModule.address,
      0,
      removeDelegateData,
      CALL,
      'remove delegate 1'
    )
    delegates = await safeModule.getDelegates(gnosisSafe.address, 0, 10)
    assert.equal(1, delegates.results.length)
    assert.equal(lw.accounts[5], delegates.results[0].toLowerCase())
  })

  it('Add and remove delegate then try to execute', async () => {
    const token = await TestToken.new({ from: accounts[0] })
    await token.transfer(gnosisSafe.address, 1000, { from: accounts[0] })

    let enableModuleData = await gnosisSafe.contract.methods
      .enableModule(safeModule.address)
      .encodeABI()
    await execTransaction(
      gnosisSafe.address,
      0,
      enableModuleData,
      CALL,
      'enable module'
    )
    let modules = await gnosisSafe.getModules()
    assert.equal(1, modules.length)
    assert.equal(safeModule.address, modules[0])

    // Add delegates
    let addDelegateData = await safeModule.contract.methods
      .addDelegate(lw.accounts[4])
      .encodeABI()
    await execTransaction(
      safeModule.address,
      0,
      addDelegateData,
      CALL,
      'add delegate 1'
    )

    let delegates = await safeModule.getDelegates(gnosisSafe.address, 0, 10)
    assert.equal(1, delegates.results.length)
    assert.equal(lw.accounts[4], delegates.results[0].toLowerCase())

    // Add allowance
    let setAllowanceData = await safeModule.contract.methods
      .setAllowance(lw.accounts[4], token.address, 100, 0, 0)
      .encodeABI()
    await execTransaction(
      safeModule.address,
      0,
      setAllowanceData,
      CALL,
      'set allowance'
    )

    // Remove delegate
    let removeDelegateData = await safeModule.contract.methods
      .removeDelegate(lw.accounts[4], false)
      .encodeABI()
    await execTransaction(
      safeModule.address,
      0,
      removeDelegateData,
      CALL,
      'remove delegate'
    )
    delegates = await safeModule.getDelegates(gnosisSafe.address, 0, 10)
    assert.equal(0, delegates.results.length)

    // Execute
    assert.equal(1000, await token.balanceOf(gnosisSafe.address))
    assert.equal(0, await token.balanceOf(accounts[1]))
    let transferHash = await safeModule.generateTransferHash(
      gnosisSafe.address,
      token.address,
      accounts[1],
      60,
      ADDRESS_0,
      0,
      1
    )
    let signature = utils.signTransaction(lw, [lw.accounts[4]], transferHash)
    await utils.assertRejects(
      safeModule.executeAllowanceTransfer(
        gnosisSafe.address,
        token.address,
        accounts[1],
        60,
        ADDRESS_0,
        0,
        lw.accounts[4],
        signature
      ),
      'executeAllowanceTransfer'
    )

    assert.equal(1000, await token.balanceOf(gnosisSafe.address))
    assert.equal(0, await token.balanceOf(accounts[1]))
  })

  it('Use zero delegate', async () => {
    const token = await TestToken.new({ from: accounts[0] })
    await token.transfer(gnosisSafe.address, 1000, { from: accounts[0] })

    let enableModuleData = await gnosisSafe.contract.methods
      .enableModule(safeModule.address)
      .encodeABI()
    await execTransaction(
      gnosisSafe.address,
      0,
      enableModuleData,
      CALL,
      'enable module'
    )
    let modules = await gnosisSafe.getModules()
    assert.equal(1, modules.length)
    assert.equal(safeModule.address, modules[0])

    // Add allowance
    let setAllowanceData = await safeModule.contract.methods
      .setAllowance(ADDRESS_0, token.address, 100, 0, 0)
      .encodeABI()
    await execTransaction(
      safeModule.address,
      0,
      setAllowanceData,
      CALL,
      'set allowance'
    )

    // Execute
    assert.equal(1000, await token.balanceOf(gnosisSafe.address))
    assert.equal(0, await token.balanceOf(accounts[1]))
    let signature = '0x'.padEnd(130, '0') + '1c'
    console.log(signature)
    await utils.assertRejects(
      safeModule.executeAllowanceTransfer(
        gnosisSafe.address,
        token.address,
        accounts[1],
        60,
        ADDRESS_0,
        0,
        ADDRESS_0,
        signature
      ),
      'executeAllowanceTransfer'
    )

    assert.equal(1000, await token.balanceOf(gnosisSafe.address))
    assert.equal(0, await token.balanceOf(accounts[1]))
  })

  it('Generates expected transfer hash', async () => {
    const token = await TestToken.new({ from: accounts[0] })

    const transfer = {
      safe: gnosisSafe.address,
      token: token.address,
      to: accounts[1],
      amount: 60,
      paymentToken: ADDRESS_0,
      payment: 0,
      nonce: 1,
    }

    let transferHash = await safeModule.generateTransferHash(
      transfer.safe,
      transfer.token,
      transfer.to,
      transfer.amount,
      transfer.paymentToken,
      transfer.payment,
      transfer.nonce
    )

    // In ganache the values for eth_chainid and CHAINID opcode are different for legacy reasons
    // therefore we hardcode the chainId here
    // From the docs:
    // --chainId: Specify the Chain ID ganache-cli will use for eth_chainId RPC and the CHAINID opcode.
    // For legacy reasons, the default is currently 1337 for eth_chainId RPC and 1 for the CHAINID opcode.
    // Setting this flag will align the chainId values.
    // This will be fixed in the next major version of ganache-cli and ganache-core!
    assert.equal(
      transferHash,
      calculateAllowanceTransferHash(safeModule.address, transfer, 1)
    )
  })
})
