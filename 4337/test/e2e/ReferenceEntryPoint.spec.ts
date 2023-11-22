import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { EventLog, Log, Signer } from 'ethers'
import EntryPointArtifact from '@account-abstraction/contracts/artifacts/EntryPoint.json'
import { getFactory, getAddModulesLib } from '../utils/setup'
import { buildSignatureBytes, logGas } from '../../src/utils/execution'
import {
  buildSafeUserOpTransaction,
  buildUserOperationFromSafeUserOperation,
  calculateSafeOperationData,
  signSafeOp,
} from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { Safe4337 } from '../../src/utils/safe'

describe('E2E - Reference EntryPoint', () => {
  const setupTests = async () => {
    await deployments.fixture()
    const [deployer, user, relayer] = await ethers.getSigners()

    const entryPoint = await deployEntryPoint(deployer, relayer)
    const moduleFactory = await ethers.getContractFactory('Safe4337Module')
    const module = await moduleFactory.deploy(await entryPoint.getAddress())
    const proxyFactory = await getFactory()
    const proxyCreationCode = await proxyFactory.proxyCreationCode()
    const addModulesLib = await getAddModulesLib()
    const singletonFactory = await ethers.getContractFactory('Safe', deployer)
    const singleton = await singletonFactory.deploy()

    const safeGlobalConfig = {
      safeSingleton: await singleton.getAddress(),
      entryPoint: await entryPoint.getAddress(),
      erc4337module: await module.getAddress(),
      proxyFactory: await proxyFactory.getAddress(),
      addModulesLib: await addModulesLib.getAddress(),
      proxyCreationCode,
      chainId: Number(await chainId()),
    }
    const safe = await Safe4337.withSigner(user.address, safeGlobalConfig)

    return {
      user,
      relayer,
      safe,
      validator: module,
      entryPoint,
      safeGlobalConfig,
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

  it('should support a Safe signer (NOTE: would require a staked paymaster for ERC-4337)', async () => {
    const { user, relayer, safe: parentSafe, validator, entryPoint, safeGlobalConfig } = await setupTests()

    await parentSafe.deploy(user)
    const daughterSafe = await Safe4337.withSigner(parentSafe.address, safeGlobalConfig)

    const accountBalance = ethers.parseEther('1.0')
    await user.sendTransaction({ to: daughterSafe.address, value: accountBalance })
    expect(await ethers.provider.getBalance(daughterSafe.address)).to.be.eq(accountBalance)

    const transfer = ethers.parseEther('0.1')
    const safeOp = buildSafeUserOpTransaction(daughterSafe.address, user.address, transfer, '0x', '0x0', await entryPoint.getAddress())
    const opData = calculateSafeOperationData(await validator.getAddress(), safeOp, await chainId())
    const signature = ethers.solidityPacked(
      ['bytes', 'bytes'],
      [
        buildSignatureBytes([
          {
            signer: parentSafe.address,
            data: ethers.solidityPacked(
              ['bytes32', 'bytes32', 'uint8'],
              [
                ethers.toBeHex(parentSafe.address, 32), // `r` holds the contract signer
                ethers.toBeHex(65, 32), // `s` holds the offset of the signature bytes
                0, // `v` of 0 indicates a contract signer
              ],
            ),
          },
        ]),
        ethers.solidityPacked(
          ['uint256', 'bytes'],
          [
            65, // signature length
            await user.signTypedData(
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
          ],
        ),
      ],
    )
    const userOp = buildUserOperationFromSafeUserOperation({
      safeAddress: daughterSafe.address,
      safeOp,
      signature,
      initCode: daughterSafe.getInitCode(),
    })

    const transaction = await logGas(
      'Execute UserOps with reference EntryPoint',
      entryPoint.handleOps([userOp], await relayer.getAddress()),
    )
    const receipt = await transaction.wait()

    const deposits = receipt.logs
      .filter(isEventLog)
      .filter((log) => log.eventName === 'Deposited')
      .reduce((acc, { args: [, deposit] }) => acc + deposit, 0n)
    expect(await ethers.provider.getBalance(daughterSafe.address)).to.be.eq(accountBalance - transfer - deposits)
  })

  function isEventLog(log: Log): log is EventLog {
    return typeof (log as Partial<EventLog>).eventName === 'string'
  }
})
