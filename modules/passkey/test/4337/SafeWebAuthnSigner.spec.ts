import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { buildSignatureBytes, logGas } from '@safe-global/safe-4337/src/utils/execution'
import {
  buildSafeUserOpTransaction,
  buildPackedUserOperationFromSafeUserOperation,
  calculateSafeOperationHash,
  signSafeOp,
} from '@safe-global/safe-4337/src/utils/userOp'
import { encodeMultiSendTransactions } from '@safe-global/safe-4337/test/utils/encoding'
import { Safe4337 } from '@safe-global/safe-4337/src/utils/safe'
import { WebAuthnCredentials } from '../utils/webauthnShim'
import { decodePublicKey, encodeWebAuthnSignature } from '../../src/utils/webauthn'

describe('SafeWebAuthnSigner', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { SafeModuleSetup, SafeL2, SafeProxyFactory, MultiSend, FCLP256Verifier, Safe4337Module, EntryPoint, SafeWebAuthnSignerFactory } =
      await deployments.fixture()

    const { chainId } = await ethers.provider.getNetwork()
    const [user] = await ethers.getSigners()

    const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
    const module = await ethers.getContractAt(Safe4337Module.abi, Safe4337Module.address)
    const proxyFactory = await ethers.getContractAt(SafeProxyFactory.abi, SafeProxyFactory.address)
    const multiSend = await ethers.getContractAt('MultiSend', MultiSend.address)
    const safeModuleSetup = await ethers.getContractAt(SafeModuleSetup.abi, SafeModuleSetup.address)
    const singleton = await ethers.getContractAt(SafeL2.abi, SafeL2.address)
    const signerFactory = await ethers.getContractAt('SafeWebAuthnSignerFactory', SafeWebAuthnSignerFactory.address)

    const verifiers = BigInt(FCLP256Verifier.address)

    const navigator = {
      credentials: new WebAuthnCredentials(),
    }

    return {
      chainId,
      user,
      proxyFactory,
      multiSend,
      safeModuleSetup,
      module,
      entryPoint,
      singleton,
      signerFactory,
      verifiers,
      navigator,
    }
  })

  describe('executeUserOp - new account', () => {
    it('should execute user operation with a pre-deployed signer', async () => {
      const { chainId, user, proxyFactory, safeModuleSetup, module, entryPoint, singleton, signerFactory, navigator, verifiers } =
        await setupTests()
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
      const publicKey = decodePublicKey(credential.response)
      await signerFactory.createSigner(publicKey.x, publicKey.y, verifiers)
      const signer = await ethers.getContractAt(
        'SafeWebAuthnSignerProxy',
        await signerFactory.getSigner(publicKey.x, publicKey.y, verifiers),
      )

      const safe = await Safe4337.withSigner(await signer.getAddress(), {
        safeSingleton: await singleton.getAddress(),
        entryPoint: await entryPoint.getAddress(),
        erc4337module: await module.getAddress(),
        proxyFactory: await proxyFactory.getAddress(),
        safeModuleSetup: await safeModuleSetup.getAddress(),
        proxyCreationCode: await proxyFactory.proxyCreationCode(),
        chainId: Number(chainId),
      })

      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user.address,
        ethers.parseEther('0.5'),
        '0x',
        '0',
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
          verificationGasLimit: 625000,
        },
      )
      const safeOpHash = calculateSafeOperationHash(await module.getAddress(), safeOp, chainId)
      const assertion = navigator.credentials.get({
        publicKey: {
          challenge: ethers.getBytes(safeOpHash),
          rpId: 'safe.global',
          allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
          userVerification: 'required',
        },
      })
      const signature = buildSignatureBytes([
        {
          signer: signer.target as string,
          data: encodeWebAuthnSignature(assertion.response),
          dynamic: true,
        },
      ])

      await user.sendTransaction({ to: safe.address, value: ethers.parseEther('1') }).then((tx) => tx.wait())
      expect(await ethers.provider.getCode(safe.address)).to.equal('0x')
      expect(await ethers.provider.getBalance(safe.address)).to.equal(ethers.parseEther('1'))

      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })
      await logGas('WebAuthn signer Safe operation', entryPoint.handleOps([userOp], user.address))

      expect(await ethers.provider.getCode(safe.address)).to.not.equal('0x')
      expect(await ethers.provider.getBalance(safe.address)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    })

    it('should execute user operation from a 1/2 Safe with a passkey owner', async () => {
      const {
        chainId,
        user,
        proxyFactory,
        safeModuleSetup,
        module,
        entryPoint,
        singleton,
        multiSend,
        signerFactory,
        navigator,
        verifiers,
      } = await setupTests()
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
      const publicKey = decodePublicKey(credential.response)
      const signer = await ethers.getContractAt(
        'SafeWebAuthnSignerProxy',
        await signerFactory.getSigner(publicKey.x, publicKey.y, verifiers),
      )

      const safe = await Safe4337.withConfigs(
        {
          signers: [user.address, await signer.getAddress()],
          threshold: 1,
          nonce: 0,
        },
        {
          safeSingleton: await singleton.getAddress(),
          entryPoint: await entryPoint.getAddress(),
          erc4337module: await module.getAddress(),
          proxyFactory: await proxyFactory.getAddress(),
          safeModuleSetup: await safeModuleSetup.getAddress(),
          proxyCreationCode: await proxyFactory.proxyCreationCode(),
          chainId: Number(chainId),
        },
      )

      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        await multiSend.getAddress(),
        ethers.parseEther('0.5'),
        multiSend.interface.encodeFunctionData('multiSend', [
          encodeMultiSendTransactions([
            {
              op: 0,
              to: user.address,
              value: ethers.parseEther('0.5'),
              data: '0x',
            },
            {
              op: 0,
              to: await signerFactory.getAddress(),
              value: 0,
              data: signerFactory.interface.encodeFunctionData('createSigner', [publicKey.x, publicKey.y, verifiers]),
            },
          ]),
        ]),
        '0',
        await entryPoint.getAddress(),
        true, // DELEGATECALL
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user, await module.getAddress(), safeOp, chainId)])

      await user.sendTransaction({ to: safe.address, value: ethers.parseEther('1') }).then((tx) => tx.wait())
      expect(await ethers.provider.getCode(safe.address)).to.equal('0x')
      expect(await ethers.provider.getCode(await signer.getAddress())).to.equal('0x')
      expect(await ethers.provider.getBalance(safe.address)).to.equal(ethers.parseEther('1'))

      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })
      await logGas('WebAuthn signer Safe operation', entryPoint.handleOps([userOp], user.address))

      expect(await ethers.provider.getCode(safe.address)).to.not.equal('0x')
      expect(await ethers.provider.getCode(await signer.getAddress())).to.not.equal('0x')
      expect(await ethers.provider.getBalance(safe.address)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))

      const safeInstance = new ethers.Contract(safe.address, singleton.interface, ethers.provider)
      expect(await safeInstance.isOwner(await signer.getAddress())).to.be.true
    })
  })

  describe('executeUserOp - existing account', () => {
    it('should execute user operation', async () => {
      const { chainId, user, proxyFactory, safeModuleSetup, module, entryPoint, singleton, signerFactory, navigator, verifiers } =
        await setupTests()
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
      const publicKey = decodePublicKey(credential.response)
      await signerFactory.createSigner(publicKey.x, publicKey.y, verifiers)
      const signer = await ethers.getContractAt(
        'SafeWebAuthnSignerProxy',
        await signerFactory.getSigner(publicKey.x, publicKey.y, verifiers),
      )

      const safe = await Safe4337.withSigner(await signer.getAddress(), {
        safeSingleton: await singleton.getAddress(),
        entryPoint: await entryPoint.getAddress(),
        erc4337module: await module.getAddress(),
        proxyFactory: await proxyFactory.getAddress(),
        safeModuleSetup: await safeModuleSetup.getAddress(),
        proxyCreationCode: await proxyFactory.proxyCreationCode(),
        chainId: Number(chainId),
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
      const safeOpHash = calculateSafeOperationHash(await module.getAddress(), safeOp, chainId)
      const assertion = navigator.credentials.get({
        publicKey: {
          challenge: ethers.getBytes(safeOpHash),
          rpId: 'safe.global',
          allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
          userVerification: 'required',
        },
      })
      const signature = buildSignatureBytes([
        {
          signer: signer.target as string,
          data: encodeWebAuthnSignature(assertion.response),
          dynamic: true,
        },
      ])

      await user.sendTransaction({ to: safe.address, value: ethers.parseEther('1') }).then((tx) => tx.wait())
      expect(await ethers.provider.getBalance(safe.address)).to.equal(ethers.parseEther('1'))

      const userOp = buildPackedUserOperationFromSafeUserOperation({ safeOp, signature })
      await logGas('WebAuthn signer Safe operation', entryPoint.handleOps([userOp], user.address))

      expect(await ethers.provider.getBalance(safe.address)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    })
  })
})
