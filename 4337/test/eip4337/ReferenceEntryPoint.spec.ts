import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { time } from '@nomicfoundation/hardhat-network-helpers'
import { EventLog, Log, Signer } from 'ethers'
import EntryPointArtifact from '@account-abstraction/contracts/artifacts/EntryPoint.json'
import { getFactory, getAddModulesLib } from '../utils/setup'
import { buildSignatureBytes, logGas } from '../../src/utils/execution'
import {
  buildUserOperationFromSafeUserOperation,
  buildSafeUserOpTransaction,
  signSafeOp,
  encodeSignatureTimestamp,
} from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { Safe4337 } from '../../src/utils/safe'

describe('Safe4337Module - Reference EntryPoint', () => {
  const setupTests = async () => {
    await deployments.fixture()
    const [deployer, user, relayer] = await ethers.getSigners()

    const entryPoint = await deployEntryPoint(deployer, relayer)
    const moduleFactory = await ethers.getContractFactory('Safe4337Module')
    const module = await moduleFactory.deploy(await entryPoint.getAddress())
    const proxyFactory = await getFactory()
    const proxyCreationCode = await proxyFactory.proxyCreationCode()
    const addModulesLib = await getAddModulesLib()
    const singletonFactory = await ethers.getContractFactory('SafeL2', deployer)
    const singleton = await singletonFactory.deploy()

    const safe = await Safe4337.withSigner(user.address, {
      safeSingleton: await singleton.getAddress(),
      entryPoint: await entryPoint.getAddress(),
      erc4337module: await module.getAddress(),
      proxyFactory: await proxyFactory.getAddress(),
      addModulesLib: await addModulesLib.getAddress(),
      proxyCreationCode,
      chainId: Number(await chainId()),
    })

    return {
      user,
      relayer,
      safe,
      validator: module,
      entryPoint,
    }
  }

  const deployEntryPoint = async (deployer: Signer, relayer: Signer) => {
    const { abi, bytecode } = EntryPointArtifact
    const transaction = await deployer.sendTransaction({ data: bytecode })
    const receipt = await transaction.wait()
    const contractAddress = receipt.contractAddress
    if (contractAddress === null) {
      throw new Error(`contract deployment transaction ${transaction.hash} missing address`)
    }
    return new ethers.Contract(contractAddress, abi, relayer)
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

  it('should correctly bubble up the signature timestamps to the entrypoint', async () => {
    const { user, relayer, safe, validator, entryPoint } = await setupTests()

    const accountBalance = ethers.parseEther('1.0')
    const now = await time.latest()
    const validAfter = now + 86400 // 1 day from now
    const validUntil = validAfter + 86400 // 1 day after validAfter
    const signatureTimestamps = encodeSignatureTimestamp(validUntil, validAfter)

    if (!now) throw new Error("Failed to fetch the latest block's timestamp found")

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
          false,
          false,
          signatureTimestamps,
        )
        const signature = buildSignatureBytes(
          [await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())],
          signatureTimestamps,
        )
        return buildUserOperationFromSafeUserOperation({
          safeAddress: safe.address,
          safeOp,
          signature,
          initCode: nonce === 0 ? safe.getInitCode() : '0x',
        })
      }),
    )

    await expect(entryPoint.handleOps(userOps, await relayer.getAddress()))
      .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
      .withArgs(0, 'AA22 expired or not due')
    await time.increaseTo(validAfter + 1)

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
