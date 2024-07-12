import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { Signer } from 'ethers'
import { getTestSafe, getSafe4337Module, getEntryPoint } from '../utils/setup'
import { buildSignatureBytes, signHash } from '../../src/utils/execution'
import {
  GasParameters,
  buildSafeUserOp,
  buildSafeUserOpTransaction,
  buildPackedUserOperationFromSafeUserOperation,
  calculateSafeOperationHash,
  packGasParameters,
  packValidationData,
  unpackGasParameters,
} from '../../src/utils/userOp'
import { chainId, timestamp } from '../utils/encoding'

describe('Safe4337Module', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const [user, untrusted] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const module = await getSafe4337Module()
    const makeSafeModule = async (user: Signer) => {
      const safe = await getTestSafe(user, await module.getAddress(), await module.getAddress())
      return await ethers.getContractAt('Safe4337Module', await safe.getAddress())
    }
    const safeModule = await makeSafeModule(user)

    return {
      user,
      untrusted,
      entryPoint,
      validator: module,
      safeModule,
      makeSafeModule,
    }
  })

  describe('getOperationHash', () => {
    it('should correctly calculate EIP-712 hash of the operation', async () => {
      const { entryPoint, validator } = await setupTests()

      const safeOp = {
        safe: '0x0000000000000000000000000000000000000011',
        nonce: 0x12,
        initCode: '0x13',
        callData: '0x14',
        preVerificationGas: 0x15,
        verificationGasLimit: 0x16,
        callGasLimit: 0x17,
        maxPriorityFeePerGas: 0x18,
        maxFeePerGas: 0x19,
        paymasterAndData: '0x1a',
        validAfter: 0x1b,
        validUntil: 0x1c,
        entryPoint: entryPoint.target as string,
      }
      const userOp = {
        sender: safeOp.safe,
        nonce: safeOp.nonce,
        initCode: safeOp.initCode,
        callData: safeOp.callData,
        preVerificationGas: safeOp.preVerificationGas,
        ...packGasParameters({
          verificationGasLimit: safeOp.verificationGasLimit,
          callGasLimit: safeOp.callGasLimit,
          maxPriorityFeePerGas: safeOp.maxPriorityFeePerGas,
          maxFeePerGas: safeOp.maxFeePerGas,
        }),
        paymasterAndData: safeOp.paymasterAndData,
        signature: ethers.solidityPacked(['uint48', 'uint48'], [safeOp.validAfter, safeOp.validUntil]),
      }

      expect(await validator.getOperationHash(userOp)).to.equal(
        calculateSafeOperationHash(validator.target as string, safeOp, await chainId()),
      )
    })

    it('should change if any UserOperation fields change', async () => {
      const { validator } = await setupTests()

      const signature = ({ validAfter, validUntil }: { validAfter: number; validUntil: number }) =>
        ethers.solidityPacked(['uint48', 'uint48'], [validAfter, validUntil])
      const userOp = {
        sender: '0x0000000000000000000000000000000000000011',
        nonce: 0x12,
        initCode: '0x13',
        callData: '0x14',
        preVerificationGas: 0x15,
        ...packGasParameters({
          verificationGasLimit: 0x16,
          callGasLimit: 0x17,
          maxPriorityFeePerGas: 0x18,
          maxFeePerGas: 0x19,
        }),
        paymasterAndData: '0x1a',
        signature: signature({
          validAfter: 0x1b,
          validUntil: 0x1c,
        }),
      }
      const operationHash = await validator.getOperationHash(userOp)

      const gasParams = (changes: Partial<GasParameters>) => packGasParameters({ ...unpackGasParameters(userOp), ...changes })
      for (const [name, value] of [
        ['sender', '0x0000000000000000000000000000000000000021'],
        ['nonce', 0x22],
        ['initCode', '0x23'],
        ['callData', '0x24'],
        ['preVerificationGas', 0x25],
        ['accountGasLimits', gasParams({ verificationGasLimit: 0x26 }).accountGasLimits],
        ['accountGasLimits', gasParams({ callGasLimit: 0x27 }).accountGasLimits],
        ['gasFees', gasParams({ maxPriorityFeePerGas: 0x28 }).gasFees],
        ['gasFees', gasParams({ maxFeePerGas: 0x29 }).gasFees],
        ['paymasterAndData', '0x2a'],
        ['signature', signature({ validAfter: 0x2b, validUntil: 0x1c })],
        ['signature', signature({ validAfter: 0x1b, validUntil: 0x2c })],
      ] as const) {
        expect(await validator.getOperationHash({ ...userOp, [name]: value })).to.not.equal(operationHash)
      }
    })
  })

  describe('constructor', () => {
    it('should revert when entry point is not specified', async () => {
      const factory = await ethers.getContractFactory('Safe4337Module')
      await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(factory, 'InvalidEntryPoint')
    })
  })

  describe('constants', () => {
    it('should correctly calculate keccak of DOMAIN_SEPARATOR_TYPEHASH', async () => {
      const { validator, safeModule } = await setupTests()

      const domainSeparator = await safeModule.domainSeparator()
      const calculatedDomainSeparatorTypehash = ethers.keccak256(
        ethers.toUtf8Bytes('EIP712Domain(uint256 chainId,address verifyingContract)'),
      )
      const calculatedDomainSeparator = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'uint256', 'address'],
          [calculatedDomainSeparatorTypehash, await chainId(), await validator.getAddress()],
        ),
      )
      expect(domainSeparator).to.eq(calculatedDomainSeparator)
    })

    it('should correctly calculate keccak of SAFE_OP_TYPEHASH', async () => {
      const { entryPoint, validator, safeModule } = await setupTests()

      const safeAddress = ethers.hexlify(ethers.randomBytes(20))
      const validAfter = (await timestamp()) + 10000
      const validUntil = validAfter + 10000000000
      const safeOp = buildSafeUserOp({
        safe: safeAddress,
        nonce: '0',
        entryPoint: await entryPoint.getAddress(),
        validAfter,
        validUntil,
      })
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature: '0x',
      })

      const operationHash = await safeModule.getOperationHash(userOp)
      const calculatedOperationHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      expect(operationHash).to.eq(calculatedOperationHash)
    })
  })

  describe('validateUserOp', () => {
    it('should revert when validating user ops for a different Safe', async () => {
      const { user, entryPoint, validator, safeModule, makeSafeModule } = await setupTests()

      const safeOp = buildSafeUserOpTransaction(await safeModule.getAddress(), user.address, 0, '0x', '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      const entryPointImpersonator = await ethers.getSigner(await entryPoint.getAddress())
      const safeFromEntryPoint = safeModule.connect(entryPointImpersonator)
      expect(await safeFromEntryPoint.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.eq(0)

      const otherSafe = (await makeSafeModule(user)).connect(entryPointImpersonator)
      await expect(otherSafe.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.be.revertedWithCustomError(
        safeModule,
        'InvalidCaller',
      )
    })

    it('should revert when calling an unsupported Safe method', async () => {
      const { user, untrusted, entryPoint, validator, safeModule } = await setupTests()

      const abi = ['function addOwnerWithThreshold(address owner, uint256 threshold) external']
      const callData = new ethers.Interface(abi).encodeFunctionData('addOwnerWithThreshold', [untrusted.address, 1])
      const safeOp = buildSafeUserOp({
        safe: await safeModule.getAddress(),
        callData,
        nonce: '0',
        entryPoint: await entryPoint.getAddress(),
      })
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      const entryPointAddress = await ethers.getSigner(await entryPoint.getAddress())
      const safeFromEntryPoint = safeModule.connect(entryPointAddress)
      await expect(safeFromEntryPoint.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0))
        .to.be.revertedWithCustomError(safeModule, 'UnsupportedExecutionFunction')
        .withArgs(ethers.dataSlice(callData, 0, 4))
    })

    it('should revert when not called from the trusted entrypoint', async () => {
      const { user, untrusted, entryPoint, validator, safeModule } = await setupTests()
      const safeOp = buildSafeUserOpTransaction(await safeModule.getAddress(), user.address, 0, '0x', '0', await entryPoint.getAddress())
      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await expect(safeModule.connect(untrusted).validateUserOp(userOp, ethers.ZeroHash, 0)).to.be.revertedWithCustomError(
        safeModule,
        'UnsupportedEntryPoint',
      )
    })

    it('should return correct validAfter and validUntil timestamps', async () => {
      const { user, safeModule, validator, entryPoint } = await setupTests()

      const validAfter = BigInt(ethers.hexlify(ethers.randomBytes(3)))
      const validUntil = validAfter + BigInt(ethers.hexlify(ethers.randomBytes(3)))

      const safeOp = buildSafeUserOpTransaction(
        await safeModule.getAddress(),
        user.address,
        0,
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          validAfter,
          validUntil,
        },
      )

      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)])
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      const packedValidationData = packValidationData(0, validUntil, validAfter)
      const entryPointImpersonator = await ethers.getSigner(await entryPoint.getAddress())
      const safeFromEntryPoint = safeModule.connect(entryPointImpersonator)

      expect(await safeFromEntryPoint.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.eq(packedValidationData)
    })

    it('should fail signature validation when signatures are too short', async () => {
      const { user, safeModule, entryPoint } = await setupTests()

      const validAfter = BigInt(ethers.hexlify(ethers.randomBytes(3)))
      const validUntil = validAfter + BigInt(ethers.hexlify(ethers.randomBytes(3)))

      const safeOp = buildSafeUserOpTransaction(
        await safeModule.getAddress(),
        user.address,
        0,
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          validAfter,
          validUntil,
        },
      )

      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature: '0x',
      })
      const packedValidationData = packValidationData(1, validUntil, validAfter)
      const entryPointImpersonator = await ethers.getSigner(await entryPoint.getAddress())
      const safeFromEntryPoint = safeModule.connect(entryPointImpersonator)

      expect(await safeFromEntryPoint.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.eq(packedValidationData)
    })

    it('should indicate failed validation data when signature length contains additional bytes', async () => {
      const { user, safeModule, validator, entryPoint } = await setupTests()

      const validAfter = BigInt(ethers.hexlify(ethers.randomBytes(3)))
      const validUntil = validAfter + BigInt(ethers.hexlify(ethers.randomBytes(3)))

      const safeOp = buildSafeUserOpTransaction(
        await safeModule.getAddress(),
        user.address,
        0,
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          validAfter,
          validUntil,
        },
      )

      const safeOpHash = calculateSafeOperationHash(await validator.getAddress(), safeOp, await chainId())
      const signature = buildSignatureBytes([await signHash(user, safeOpHash)]).concat('00')
      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })
      const packedValidationData = packValidationData(1, validUntil, validAfter)
      const entryPointImpersonator = await ethers.getSigner(await entryPoint.getAddress())
      const safeFromEntryPoint = safeModule.connect(entryPointImpersonator)

      expect(await safeFromEntryPoint.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.eq(packedValidationData)
    })

    it('should indicate failed validation data when dynamic position pointer is invalid', async () => {
      const { user, safeModule, entryPoint } = await setupTests()

      const validAfter = BigInt(ethers.hexlify(ethers.randomBytes(3)))
      const validUntil = validAfter + BigInt(ethers.hexlify(ethers.randomBytes(3)))

      const safeOp = buildSafeUserOpTransaction(
        await safeModule.getAddress(),
        user.address,
        0,
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          validAfter,
          validUntil,
        },
      )

      const userOp = buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature: ethers.concat([
          ethers.randomBytes(32),
          ethers.toBeHex(0, 32), // point to start of the signatures bytes
          '0x00', // contract signature type
        ]),
      })
      const packedValidationData = packValidationData(1, validUntil, validAfter)
      const entryPointImpersonator = await ethers.getSigner(await entryPoint.getAddress())
      const safeFromEntryPoint = safeModule.connect(entryPointImpersonator)

      expect(await safeFromEntryPoint.validateUserOp.staticCall(userOp, ethers.ZeroHash, 0)).to.eq(packedValidationData)
    })
  })

  describe('execUserOp', () => {
    it('should revert when not called from the trusted entrypoint', async () => {
      const { untrusted, safeModule } = await setupTests()
      await expect(safeModule.connect(untrusted).executeUserOp(ethers.ZeroAddress, 0, '0x', 0)).to.be.revertedWithCustomError(
        safeModule,
        'UnsupportedEntryPoint',
      )
    })
  })

  describe('execUserOpWithErrorString', () => {
    it('should revert when not called from the trusted entrypoint', async () => {
      const { untrusted, safeModule } = await setupTests()
      await expect(
        safeModule.connect(untrusted).executeUserOpWithErrorString(ethers.ZeroAddress, 0, '0x', 0),
      ).to.be.revertedWithCustomError(safeModule, 'UnsupportedEntryPoint')
    })
  })
})
