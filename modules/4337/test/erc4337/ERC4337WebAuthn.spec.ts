import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getEntryPoint } from '../utils/setup'
import { buildSignatureBytes, logGas } from '../../src/utils/execution'
import { buildSafeUserOpTransaction, buildUserOperationFromSafeUserOperation, calculateSafeOperationHash } from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import {
  UserVerificationRequirement,
  WebAuthnCredentials,
  extractClientDataFields,
  extractPublicKey,
  extractSignature,
} from '../utils/webauthn'
import { Safe4337 } from '../../src/utils/safe'

describe('Safe4337Module - WebAuthn Owner', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { SafeModuleSetup, SafeL2, SafeProxyFactory, WebAuthnVerifier } = await deployments.fixture()

    const [user] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const moduleFactory = await ethers.getContractFactory('Safe4337Module')
    const module = await moduleFactory.deploy(entryPoint.target)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const safeModuleSetup = await ethers.getContractAt('SafeModuleSetup', SafeModuleSetup.address)
    const signerLaunchpadFactory = await ethers.getContractFactory('SafeSignerLaunchpad')
    const signerLaunchpad = await signerLaunchpadFactory.deploy(entryPoint.target)
    const singleton = await ethers.getContractAt('SafeL2', SafeL2.address)
    const webAuthnVerifier = await ethers.getContractAt('WebAuthnVerifier', WebAuthnVerifier.address)

    const WebAuthnSignerFactory = await ethers.getContractFactory('WebAuthnSignerFactory')
    const signerFactory = await WebAuthnSignerFactory.deploy()

    const navigator = {
      credentials: new WebAuthnCredentials(),
    }

    return {
      user,
      proxyFactory,
      safeModuleSetup,
      module,
      entryPoint,
      signerLaunchpad,
      singleton,
      signerFactory,
      navigator,
      webAuthnVerifier,
    }
  })

  describe('executeUserOp - new account', () => {
    it('should execute user operation', async () => {
      const {
        user,
        proxyFactory,
        safeModuleSetup,
        module,
        entryPoint,
        signerLaunchpad,
        singleton,
        signerFactory,
        navigator,
        webAuthnVerifier,
      } = await setupTests()
      const webAuthnVerifierAddress = await webAuthnVerifier.getAddress()

      const credential = navigator.credentials.create({
        publicKey: {
          rp: {
            name: 'Safe',
            id: 'safe.global',
          },
          user: {
            id: ethers.getBytes(ethers.id('chucknorris')),
            name: 'chucknorris',
            displayName: 'Chuck Norris',
          },
          challenge: ethers.toBeArray(Date.now()),
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        },
      })
      const publicKey = extractPublicKey(credential.response)
      const signerData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'address'],
        [publicKey.x, publicKey.y, webAuthnVerifierAddress],
      )
      const signerAddress = await signerFactory.getSigner(signerData)

      const safeInit = {
        singleton: singleton.target,
        signerFactory: signerFactory.target,
        signerData,
        setupTo: safeModuleSetup.target,
        setupData: safeModuleSetup.interface.encodeFunctionData('enableModules', [[module.target]]),
        fallbackHandler: module.target,
      }
      const safeInitHash = ethers.TypedDataEncoder.hash(
        { verifyingContract: await signerLaunchpad.getAddress(), chainId: await chainId() },
        {
          SafeInit: [
            { type: 'address', name: 'singleton' },
            { type: 'address', name: 'signerFactory' },
            { type: 'bytes', name: 'signerData' },
            { type: 'address', name: 'setupTo' },
            { type: 'bytes', name: 'setupData' },
            { type: 'address', name: 'fallbackHandler' },
          ],
        },
        safeInit,
      )

      expect(
        await signerLaunchpad.getInitHash(
          safeInit.singleton,
          safeInit.signerFactory,
          safeInit.signerData,
          safeInit.setupTo,
          safeInit.setupData,
          safeInit.fallbackHandler,
        ),
      ).to.equal(safeInitHash)

      const launchpadInitializer = signerLaunchpad.interface.encodeFunctionData('preValidationSetup', [
        safeInitHash,
        ethers.ZeroAddress,
        '0x',
      ])
      const safeSalt = Date.now()
      const safe = await proxyFactory.createProxyWithNonce.staticCall(signerLaunchpad.target, launchpadInitializer, safeSalt)

      const userOp = {
        sender: safe,
        nonce: ethers.toBeHex(await entryPoint.getNonce(safe, 0)),
        initCode: ethers.solidityPacked(
          ['address', 'bytes'],
          [
            proxyFactory.target,
            proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [signerLaunchpad.target, launchpadInitializer, safeSalt]),
          ],
        ),
        callData: signerLaunchpad.interface.encodeFunctionData('initializeThenUserOp', [
          safeInit.singleton,
          safeInit.signerFactory,
          safeInit.signerData,
          safeInit.setupTo,
          safeInit.setupData,
          safeInit.fallbackHandler,
          module.interface.encodeFunctionData('executeUserOp', [user.address, ethers.parseEther('0.5'), '0x', 0]),
        ]),
        callGasLimit: ethers.toBeHex(2500000),
        verificationGasLimit: ethers.toBeHex(500000),
        preVerificationGas: ethers.toBeHex(60000),
        maxFeePerGas: ethers.toBeHex(10000000000),
        maxPriorityFeePerGas: ethers.toBeHex(10000000000),
        paymasterAndData: '0x',
      }

      const safeInitOp = {
        userOpHash: await entryPoint.getUserOpHash({ ...userOp, signature: '0x' }),
        validAfter: 0,
        validUntil: 0,
        entryPoint: entryPoint.target,
      }
      const safeInitOpHash = ethers.TypedDataEncoder.hash(
        { verifyingContract: await signerLaunchpad.getAddress(), chainId: await chainId() },
        {
          SafeInitOp: [
            { type: 'bytes32', name: 'userOpHash' },
            { type: 'uint48', name: 'validAfter' },
            { type: 'uint48', name: 'validUntil' },
            { type: 'address', name: 'entryPoint' },
          ],
        },
        safeInitOp,
      )

      const assertion = navigator.credentials.get({
        publicKey: {
          challenge: ethers.getBytes(safeInitOpHash),
          rpId: 'safe.global',
          allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
          userVerification: UserVerificationRequirement.required,
        },
      })
      const signature = ethers.solidityPacked(
        ['uint48', 'uint48', 'bytes'],
        [
          safeInitOp.validAfter,
          safeInitOp.validUntil,
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes', 'bytes', 'uint256[2]'],
            [
              new Uint8Array(assertion.response.authenticatorData),
              extractClientDataFields(assertion.response),
              extractSignature(assertion.response),
            ],
          ),
        ],
      )

      await user.sendTransaction({ to: safe, value: ethers.parseEther('1') }).then((tx) => tx.wait())
      expect(await ethers.provider.getBalance(safe)).to.equal(ethers.parseEther('1'))
      expect(await ethers.provider.getCode(safe)).to.equal('0x')
      expect(await ethers.provider.getCode(signerAddress)).to.equal('0x')

      await logGas('WebAuthn signer Safe deployment', entryPoint.handleOps([{ ...userOp, signature }], user.address))

      expect(await ethers.provider.getBalance(safe)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
      expect(await ethers.provider.getCode(safe)).to.not.equal('0x')
      expect(await ethers.provider.getCode(signerAddress)).to.not.equal('0x')

      const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
      expect(implementation).to.equal(singleton.target)

      const safeInstance = await ethers.getContractAt('SafeL2', safe)
      expect(await safeInstance.getOwners()).to.deep.equal([signerAddress])
    })
  })

  describe('executeUserOp - existing account', () => {
    it('should execute user operation', async () => {
      const { user, proxyFactory, safeModuleSetup, module, entryPoint, singleton, signerFactory, navigator, webAuthnVerifier } =
        await setupTests()
      const webAuthnVerifierAddress = await webAuthnVerifier.getAddress()
      const credential = navigator.credentials.create({
        publicKey: {
          rp: {
            name: 'Safe',
            id: 'safe.global',
          },
          user: {
            id: ethers.getBytes(ethers.id('chucknorris')),
            name: 'chucknorris',
            displayName: 'Chuck Norris',
          },
          challenge: ethers.toBeArray(Date.now()),
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        },
      })
      const publicKey = extractPublicKey(credential.response)
      const signerData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'address'],
        [publicKey.x, publicKey.y, webAuthnVerifierAddress],
      )
      await signerFactory.createSigner(signerData)
      const signer = await ethers.getContractAt('WebAuthnSigner', await signerFactory.getSigner(signerData))

      const safe = await Safe4337.withSigner(await signer.getAddress(), {
        safeSingleton: await singleton.getAddress(),
        entryPoint: await entryPoint.getAddress(),
        erc4337module: await module.getAddress(),
        proxyFactory: await proxyFactory.getAddress(),
        safeModuleSetup: await safeModuleSetup.getAddress(),
        proxyCreationCode: await proxyFactory.proxyCreationCode(),
        chainId: Number(await chainId()),
      })
      await safe.deploy(user)

      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
      )
      const safeOpHash = calculateSafeOperationHash(await module.getAddress(), safeOp, await chainId())
      const assertion = navigator.credentials.get({
        publicKey: {
          challenge: ethers.getBytes(safeOpHash),
          rpId: 'safe.global',
          allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
          userVerification: UserVerificationRequirement.required,
        },
      })
      const signature = buildSignatureBytes([
        {
          signer: signer.target as string,
          data: ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes', 'bytes', 'uint256[2]'],
            [
              new Uint8Array(assertion.response.authenticatorData),
              extractClientDataFields(assertion.response),
              extractSignature(assertion.response),
            ],
          ),
          dynamic: true,
        },
      ])

      await user.sendTransaction({ to: safe.address, value: ethers.parseEther('1') }).then((tx) => tx.wait())
      expect(await ethers.provider.getBalance(safe.address)).to.equal(ethers.parseEther('1'))

      const userOp = buildUserOperationFromSafeUserOperation({ safeOp, signature })
      await logGas('WebAuthn signer Safe operation', entryPoint.handleOps([userOp], user.address))

      expect(await ethers.provider.getBalance(safe.address)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    })
  })
})
