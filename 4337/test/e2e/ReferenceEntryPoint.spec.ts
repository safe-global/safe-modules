import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { EventLog, Log } from 'ethers'
import { buildSignatureBytes, logGas } from '../../src/utils/execution'
import { buildUserOperationFromSafeUserOperation, buildSafeUserOpTransaction, signSafeOp } from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { Safe4337 } from '../../src/utils/safe'
import { makeAccounts } from '../utils/accounts'

describe('E2E - Reference EntryPoint', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = async () => {
    const {
      AddModulesLib,
      EntryPoint,
      Safe4337Module,
      SafeL2,
      SafeProxyFactory,
    } = await deployments.fixture()
    const [user, relayer] = await makeAccounts({
      count: 2,
      fund: ethers.parseEther("1.1"),
    });

    const entryPoint = new ethers.Contract(EntryPoint.address, EntryPoint.abi, relayer)
    const validator = await ethers.getContractAt('Safe4337Module', Safe4337Module.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const proxyCreationCode = await proxyFactory.proxyCreationCode()

    const safe = await Safe4337.withSigner(user.address, {
      safeSingleton: SafeL2.address,
      entryPoint: EntryPoint.address,
      erc4337module: Safe4337Module.address,
      proxyFactory: SafeProxyFactory.address,
      addModulesLib: AddModulesLib.address,
      proxyCreationCode,
      chainId: Number(await chainId()),
    })

    return {
      user,
      relayer,
      safe,
      validator,
      entryPoint,
    }
  }

  it('should deploy a Safe and execute transactions', async () => {
    const { user, relayer, safe, validator, entryPoint } = await setupTests()

    const accountBalance = ethers.parseEther('1.0')
    await user.sendTransaction({ to: safe.address, value: accountBalance })
    expect(await ethers.provider.getBalance(safe.address)).to.be.eq(accountBalance)

    const userOps = await Promise.all(
      [...Array(2)].map(async (_, nonce) => {
        const safeOp = buildSafeUserOpTransaction(
          safe.address,
          user.address,
          ethers.parseEther('0.1'),
          '0x',
          `${nonce}`,
          await entryPoint.getAddress(),
        )
        const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
        return buildUserOperationFromSafeUserOperation({
          safeAddress: safe.address,
          safeOp,
          signature,
          initCode: nonce === 0 ? safe.getInitCode() : '0x',
        })
      }),
    )

    const transaction = await logGas('Execute UserOps with reference EntryPoint', entryPoint.handleOps(userOps, await relayer.getAddress()))
    const receipt = await transaction.wait()

    const transfers = ethers.parseEther('0.1') * BigInt(userOps.length)
    const deposits = receipt.logs
      .filter(isEventLog)
      .filter((log) => log.eventName === 'Deposited')
      .reduce((acc, { args: [, deposit] }) => acc + deposit, 0n)
    expect(await ethers.provider.getBalance(safe.address)).to.be.eq(accountBalance - transfers - deposits)
  })

  function isEventLog(log: Log): log is EventLog {
    return typeof (log as Partial<EventLog>).eventName === 'string'
  }
})
