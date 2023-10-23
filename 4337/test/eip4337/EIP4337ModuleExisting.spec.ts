import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getTestSafe, getSimple4337Module, getEntryPoint } from '../utils/setup'
import { buildSignatureBytes, signHash, logGas } from '../../src/utils/execution'
import {
  buildSafeUserOp,
  calculateSafeOperationHash,
  buildUserOperationFromSafeUserOperation,
  buildSafeUserOpTransaction,
} from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'

describe('EIP4337Module - Existing Safe', async () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user1] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const module = await getSimple4337Module()
    const safe = await getTestSafe(user1, await module.getAddress(), await module.getAddress())

    return {
      user1,
      safe,
      validator: module,
      entryPoint
    }
  })

  describe('getOperationHash', () => {
    it('should correctly calculate EIP-712 hash of the operation', async () => {
      const { safe, validator, entryPoint } = await setupTests()

      const operation = buildSafeUserOp({ safe: await safe.getAddress(), nonce: '0', entryPoint: await entryPoint.getAddress() })
      const operationHash = await validator.getOperationHash(
        await safe.getAddress(),
        operation.callData,
        operation.nonce,
        operation.preVerificationGas,
        operation.verificationGasLimit,
        operation.callGasLimit,
        operation.maxFeePerGas,
        operation.maxPriorityFeePerGas,
        operation.entryPoint,
      )

      expect(operationHash).to.equal(calculateSafeOperationHash(await validator.getAddress(), operation, await chainId()))
    })
  })

  describe('execTransaction - existing account', () => {

    it('should revert with invalid signature', async () => {
      const { user1, safe, entryPoint } = await setupTests()

      await user1.sendTransaction({to: await safe.getAddress(), value: ethers.parseEther("1.0")})
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther("1.0"))
      const safeOp = buildSafeUserOpTransaction(await safe.getAddress(), user1.address, ethers.parseEther("0.5"), "0x", '0', await entryPoint.getAddress())
      const signature = buildSignatureBytes([await signHash(user1, ethers.keccak256("0xbaddad42"))])
      const userOp = buildUserOperationFromSafeUserOperation({safeAddress: await safe.getAddress(), safeOp, signature})
      await expect(entryPoint.executeUserOp(userOp, 0)).to.be.revertedWith("Signature validation failed")
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther("1.0"))
    })

    it('should execute contract calls without fee', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({to: await safe.getAddress(), value: ethers.parseEther("1.0")})
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther("1.0"))
      const safeOp = buildSafeUserOpTransaction(await safe.getAddress(), user1.address, ethers.parseEther("0.5"), "0x", '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({safeAddress: await safe.getAddress(), safeOp, signature})
      await logGas(
        "Execute UserOp without fee payment",
        entryPoint.executeUserOp(userOp, 0)
      )
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther("0.5"))
    })

    it('should not be able to execute contract calls twice', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({to: await safe.getAddress(), value: ethers.parseEther("1.0")})
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther("1.0"))
      const safeOp = buildSafeUserOpTransaction(await safe.getAddress(), user1.address, ethers.parseEther("0.5"), "0x", '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({safeAddress: await safe.getAddress(), safeOp, signature})
      await logGas(
        "Execute UserOp without fee payment",
        entryPoint.executeUserOp(userOp, 0)
      )
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther("0.5"))
      await expect(entryPoint.executeUserOp(userOp, 0)).to.be.revertedWithCustomError(entryPoint, "InvalidNonce").withArgs(0)
    })

    it('should execute contract calls with fee', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({to: await safe.getAddress(), value: ethers.parseEther("1.0")})
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther("1.0"))
      const safeOp = buildSafeUserOpTransaction(await safe.getAddress(), user1.address, ethers.parseEther("0.5"), "0x", '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({safeAddress: await safe.getAddress(), safeOp, signature})
      await logGas(
        "Execute UserOp with fee payment",
        entryPoint.executeUserOp(userOp, ethers.parseEther("0.000001"))
      )
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther("0.499999"))
    })

    it('reverts on failure', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()

      await user1.sendTransaction({to: await safe.getAddress(), value: ethers.parseEther("0.000001")})
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther("0.000001"))
      const safeOp = buildSafeUserOpTransaction(await safe.getAddress(), user1.address, ethers.parseEther("0.5"), "0x", '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({safeAddress: await safe.getAddress(), safeOp, signature})

      const transaction = await entryPoint.executeUserOp(userOp, ethers.parseEther("0.000001")).then((tx: any) => tx.wait())
      const logs = transaction.logs.map((log: any) => entryPoint.interface.parseLog(log))
      const emittedRevert = logs.some((l: any) => l.name === "UserOpReverted")

      expect(emittedRevert).to.be.true
    })

    it('executeUserOpWithErrorString reverts on failure and bubbles up the revert reason', async () => {
      const { user1, safe, validator, entryPoint } = await setupTests()
      const reverterContract = await ethers.getContractFactory("TestReverter").then(factory => factory.deploy())
      const callData = reverterContract.interface.encodeFunctionData("alwaysReverting")

      await user1.sendTransaction({to: await safe.getAddress(), value: ethers.parseEther("0.000001")})
      expect(await ethers.provider.getBalance(await safe.getAddress())).to.be.eq(ethers.parseEther("0.000001"))
      const safeOp = buildSafeUserOpTransaction(await safe.getAddress(), await reverterContract.getAddress(), 0, callData, '0', await entryPoint.getAddress(), false, true)
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user1, safeOpHash)])
      const userOp = buildUserOperationFromSafeUserOperation({safeAddress: await safe.getAddress(), safeOp, signature})

      const transaction = await entryPoint.executeUserOp(userOp, ethers.parseEther("0.000001")).then((tx: any) => tx.wait())
      const logs = transaction.logs.map((log: any) => entryPoint.interface.parseLog(log))
      const emittedRevert = logs.find((l: any) => l.name === "UserOpReverted")
      const decodedError = ethers.AbiCoder.defaultAbiCoder().decode(["string"], `0x${emittedRevert.args.reason.slice(10)}`)
      expect(decodedError[0]).to.equal("You called a function that always reverts")
    })
  })
})
