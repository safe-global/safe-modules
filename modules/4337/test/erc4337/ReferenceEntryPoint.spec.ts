import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { time } from '@nomicfoundation/hardhat-network-helpers'
import { EventLog, Log } from 'ethers'
import { getEntryPoint, getFactory, getSafeModuleSetup } from '../utils/setup'
import { buildSignatureBytes, logUserOperationGas } from '../../src/utils/execution'
import {
  buildSafeUserOpTransaction,
  buildPackedUserOperationFromSafeUserOperation,
  calculateSafeOperationData,
  signSafeOp,
} from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { Safe4337 } from '../../src/utils/safe'

describe('Safe4337Module - Reference EntryPoint', () => {
  const setupTests = async () => {
    await deployments.fixture()
    const [user, deployer, relayer] = await ethers.getSigners()

    const entryPoint = await getEntryPoint()
    const moduleFactory = await ethers.getContractFactory('Safe4337Module')
    const module = await moduleFactory.deploy(await entryPoint.getAddress())
    const proxyFactory = await getFactory()
    const proxyCreationCode = await proxyFactory.proxyCreationCode()
    const safeModuleSetup = await getSafeModuleSetup()
    const singletonFactory = await ethers.getContractFactory('SafeL2', deployer)
    const singleton = await singletonFactory.deploy()

    const safeGlobalConfig = {
      safeSingleton: await singleton.getAddress(),
      entryPoint: await entryPoint.getAddress(),
      erc4337module: await module.getAddress(),
      proxyFactory: await proxyFactory.getAddress(),
      safeModuleSetup: await safeModuleSetup.getAddress(),
      proxyCreationCode,
      chainId: Number(await chainId()),
    }
    const safe = Safe4337.withSigner(user.address, safeGlobalConfig)

    return {
      user,
      relayer,
      safe,
      validator: module,
      entryPoint,
      safeGlobalConfig,
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
          false,
          false,
          {
            initCode: nonce === 0 ? safe.getInitCode() : '0x',
          },
        )

        const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
        return buildPackedUserOperationFromSafeUserOperation({
          safeOp,
          signature,
        })
      }),
    )

    const { transactionResponse } = await logUserOperationGas(
      'Execute UserOps with reference EntryPoint',
      entryPoint,
      entryPoint.handleOps(userOps, await relayer.getAddress()),
    )
    const receipt = await transactionResponse.wait()

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
          {
            initCode: nonce === 0 ? safe.getInitCode() : '0x',
            validAfter,
            validUntil,
          },
        )
        const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
        return buildPackedUserOperationFromSafeUserOperation({
          safeOp,
          signature,
        })
      }),
    )

    await expect(entryPoint.handleOps(userOps, await relayer.getAddress()))
      .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
      .withArgs(0, 'AA22 expired or not due')
    await time.increaseTo(validAfter + 1)

    const { transactionResponse } = await logUserOperationGas(
      'Execute UserOps with reference EntryPoint',
      entryPoint,
      entryPoint.handleOps(userOps, await relayer.getAddress()),
    )
    const receipt = await transactionResponse.wait()

    const transfers = ethers.parseEther('0.1') * BigInt(userOps.length)
    const deposits = receipt.logs
      .filter(isEventLog)
      .filter((log) => log.eventName === 'Deposited')
      .reduce((acc, { args: [, deposit] }) => acc + deposit, 0n)
    expect(await ethers.provider.getBalance(safe.address)).to.be.eq(accountBalance - transfers - deposits)
  })

  it('should support a Safe signer (NOTE: would require a staked paymaster for ERC-4337)', async () => {
    const { user, relayer, safe: parentSafe, validator, entryPoint, safeGlobalConfig } = await setupTests()

    await parentSafe.deploy(user)
    const daughterSafe = Safe4337.withSigner(parentSafe.address, safeGlobalConfig)

    const accountBalance = ethers.parseEther('1.0')
    await user.sendTransaction({ to: daughterSafe.address, value: accountBalance })
    expect(await ethers.provider.getBalance(daughterSafe.address)).to.be.eq(accountBalance)

    const transfer = ethers.parseEther('0.1')
    const safeOp = buildSafeUserOpTransaction(
      daughterSafe.address,
      user.address,
      transfer,
      '0x',
      '0x0',
      await entryPoint.getAddress(),
      false,
      false,
      {
        initCode: daughterSafe.getInitCode(),
      },
    )

    const opData = calculateSafeOperationData(await validator.getAddress(), safeOp, await chainId())
    const signature = buildSignatureBytes([
      {
        signer: parentSafe.address,
        data: await user.signTypedData(
          {
            verifyingContract: parentSafe.address,
            chainId: await chainId(),
          },
          {
            SafeMessage: [{ type: 'bytes', name: 'message' }],
          },
          {
            message: opData,
          },
        ),
        dynamic: true,
      },
    ])
    const userOp = buildPackedUserOperationFromSafeUserOperation({
      safeOp,
      signature,
    })

    const { transactionResponse } = await logUserOperationGas(
      'Execute UserOps with reference EntryPoint',
      entryPoint,
      entryPoint.handleOps([userOp], await relayer.getAddress()),
    )
    const receipt = await transactionResponse.wait()

    const deposits = receipt.logs
      .filter(isEventLog)
      .filter((log) => log.eventName === 'Deposited')
      .reduce((acc, { args: [, deposit] }) => acc + deposit, 0n)
    expect(await ethers.provider.getBalance(daughterSafe.address)).to.be.eq(accountBalance - transfer - deposits)
  })

  it('should revert on invalid signature length - EOA signature', async () => {
    const { user, relayer, safe, validator, entryPoint } = await setupTests()

    const accountBalance = ethers.parseEther('1.0')
    await user.sendTransaction({ to: safe.address, value: accountBalance })
    expect(await ethers.provider.getBalance(safe.address)).to.be.eq(accountBalance)

    const safeOp = buildSafeUserOpTransaction(
      safe.address,
      user.address,
      ethers.parseEther('0.1'),
      '0x',
      `0`,
      await entryPoint.getAddress(),
      false,
      false,
      {
        initCode: safe.getInitCode(),
      },
    )

    const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
    const userOp = buildPackedUserOperationFromSafeUserOperation({
      safeOp,
      signature: signature.concat('00'), // adding '00' invalidates signature length
    })

    await expect(entryPoint.handleOps([userOp], await relayer.getAddress()))
      .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
      .withArgs(0, 'AA24 signature error')
  })

  it('should revert on invalid signature length - Smart contract signature', async () => {
    const { user, relayer, safe: parentSafe, validator, entryPoint, safeGlobalConfig } = await setupTests()

    await parentSafe.deploy(user)
    const daughterSafe = Safe4337.withSigner(parentSafe.address, safeGlobalConfig)

    const accountBalance = ethers.parseEther('1.0')
    await user.sendTransaction({ to: daughterSafe.address, value: accountBalance })
    expect(await ethers.provider.getBalance(daughterSafe.address)).to.be.eq(accountBalance)

    const transfer = ethers.parseEther('0.1')
    const safeOp = buildSafeUserOpTransaction(
      daughterSafe.address,
      user.address,
      transfer,
      '0x',
      '0x0',
      await entryPoint.getAddress(),
      false,
      false,
      {
        initCode: daughterSafe.getInitCode(),
      },
    )

    const opData = calculateSafeOperationData(await validator.getAddress(), safeOp, await chainId())
    const signature = buildSignatureBytes([
      {
        signer: parentSafe.address,
        data: await user.signTypedData(
          {
            verifyingContract: parentSafe.address,
            chainId: await chainId(),
          },
          {
            SafeMessage: [{ type: 'bytes', name: 'message' }],
          },
          {
            message: opData,
          },
        ),
        dynamic: true,
      },
    ])
    const userOp = buildPackedUserOperationFromSafeUserOperation({
      safeOp,
      signature: signature.concat('00'), // adding '00' invalidates signature length
    })

    await expect(entryPoint.handleOps([userOp], await relayer.getAddress()))
      .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
      .withArgs(0, 'AA24 signature error')
  })

  it('should revert when signature offset points to invalid part of signature data - Smart contract signature', async () => {
    const { user, relayer, safe: parentSafe, validator, entryPoint, safeGlobalConfig } = await setupTests()

    await parentSafe.deploy(user)
    const daughterSafe = Safe4337.withSigner(parentSafe.address, safeGlobalConfig)

    const accountBalance = ethers.parseEther('1.0')
    await user.sendTransaction({ to: daughterSafe.address, value: accountBalance })
    expect(await ethers.provider.getBalance(daughterSafe.address)).to.be.eq(accountBalance)

    const transfer = ethers.parseEther('0.1')
    const safeOp = buildSafeUserOpTransaction(
      daughterSafe.address,
      user.address,
      transfer,
      '0x',
      '0x0',
      await entryPoint.getAddress(),
      false,
      false,
      {
        initCode: daughterSafe.getInitCode(),
      },
    )

    const opData = calculateSafeOperationData(await validator.getAddress(), safeOp, await chainId())

    const parentSafeSignature = await user.signTypedData(
      {
        verifyingContract: parentSafe.address,
        chainId: await chainId(),
      },
      {
        SafeMessage: [{ type: 'bytes', name: 'message' }],
      },
      {
        message: opData,
      },
    )

    // The 2nd word of static part of signature containing invalid value pointing to dynamic part
    const signature = ethers.concat([
      ethers.zeroPadValue(parentSafe.address, 32), // address of the signer
      ethers.toBeHex(0, 32), // offset of the start of the signature
      '0x00', // contract signature type
      ethers.toUtf8Bytes('padding'), // extra illegal padding between signatures
      ethers.toBeHex(ethers.dataLength(parentSafeSignature), 32), // length of the dynamic signature
      parentSafeSignature,
    ])

    const userOp = buildPackedUserOperationFromSafeUserOperation({
      safeOp,
      signature,
    })

    await expect(entryPoint.handleOps([userOp], await relayer.getAddress()))
      .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
      .withArgs(0, 'AA24 signature error')
  })

  it('should revert when padded with additional bytes in-between signatures - Smart contract signature', async () => {
    const { user, relayer, safe: parentSafe, validator, entryPoint, safeGlobalConfig } = await setupTests()

    await parentSafe.deploy(user)
    const daughterSafe = Safe4337.withSigner(parentSafe.address, safeGlobalConfig)

    const accountBalance = ethers.parseEther('1.0')
    await user.sendTransaction({ to: daughterSafe.address, value: accountBalance })
    expect(await ethers.provider.getBalance(daughterSafe.address)).to.be.eq(accountBalance)

    const transfer = ethers.parseEther('0.1')
    const safeOp = buildSafeUserOpTransaction(
      daughterSafe.address,
      user.address,
      transfer,
      '0x',
      '0x0',
      await entryPoint.getAddress(),
      false,
      false,
      {
        initCode: daughterSafe.getInitCode(),
      },
    )

    const opData = calculateSafeOperationData(await validator.getAddress(), safeOp, await chainId())

    const parentSafeSignature = await user.signTypedData(
      {
        verifyingContract: parentSafe.address,
        chainId: await chainId(),
      },
      {
        SafeMessage: [{ type: 'bytes', name: 'message' }],
      },
      {
        message: opData,
      },
    )

    // Here signature contains additional bytes in between signatures
    const signature = ethers.concat([
      ethers.zeroPadValue(parentSafe.address, 32), // address of the signer
      ethers.toBeHex(65 + 'padding'.length, 32), // offset of the start of the signature
      '0x00', // contract signature type
      ethers.toUtf8Bytes('padding'), // extra illegal padding between signatures
      ethers.toBeHex(ethers.dataLength(parentSafeSignature), 32), // length of the dynamic signature
      parentSafeSignature,
    ])

    const userOp = buildPackedUserOperationFromSafeUserOperation({
      safeOp,
      signature,
    })

    await expect(entryPoint.handleOps([userOp], await relayer.getAddress()))
      .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
      .withArgs(0, 'AA24 signature error')

    // Here signature contains additional bytes in between signatures along with invalid length value
    const signature2 = ethers.concat([
      ethers.zeroPadValue(parentSafe.address, 32), // address of the signer
      ethers.toBeHex(65 + 'padding'.length, 32), // offset of the start of the signature
      '0x00', // contract signature type
      ethers.toUtf8Bytes('padding'), // extra illegal padding between signatures
      ethers.toBeHex(ethers.dataLength(parentSafeSignature) + 'padding'.length, 32), // length of the dynamic signature
      parentSafeSignature,
    ])

    const userOp2 = buildPackedUserOperationFromSafeUserOperation({
      safeOp,
      signature: signature2,
    })

    await expect(entryPoint.handleOps([userOp2], await relayer.getAddress()))
      .to.be.revertedWithCustomError(entryPoint, 'FailedOp')
      .withArgs(0, 'AA24 signature error')
  })

  function isEventLog(log: Log): log is EventLog {
    return typeof (log as Partial<EventLog>).eventName === 'string'
  }
})
