import { bundlerRpc, prepareAccounts, waitForUserOp } from '@safe-global/safe-4337-local-bundler'
import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { encodeMultiSendTransactions } from '@safe-global/safe-4337/test/utils/encoding'
import {
  buildSafeUserOpTransaction,
  buildPackedUserOperationFromSafeUserOperation,
  buildRpcUserOperationFromSafeUserOperation,
} from '@safe-global/safe-4337/src/utils/userOp'
import { buildSignatureBytes } from '@safe-global/safe-4337/src/utils/execution'
import { WebAuthnCredentials } from '../../test/utils/webauthnShim'
import { decodePublicKey, encodeWebAuthnSignature } from '../../src/utils/webauthn'

describe('WebAuthn Singleton Signers [@4337]', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { EntryPoint, Safe4337Module, SafeProxyFactory, SafeModuleSetup, MultiSend, SafeL2, FCLP256Verifier } = await deployments.run()
    const [user] = await prepareAccounts()
    const bundler = bundlerRpc()

    const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
    const module = await ethers.getContractAt(Safe4337Module.abi, Safe4337Module.address)
    const proxyFactory = await ethers.getContractAt(SafeProxyFactory.abi, SafeProxyFactory.address)
    const safeModuleSetup = await ethers.getContractAt(SafeModuleSetup.abi, SafeModuleSetup.address)
    const multiSend = await ethers.getContractAt(MultiSend.abi, MultiSend.address)
    const singleton = await ethers.getContractAt(SafeL2.abi, SafeL2.address)
    const verifier = await ethers.getContractAt('IP256Verifier', FCLP256Verifier.address)

    const TestStakedFactory = await ethers.getContractFactory('TestStakedFactory')
    const stakedFactory = await TestStakedFactory.deploy(proxyFactory.target)
    const stake = ethers.parseEther('1.0')
    await stakedFactory
      .stakeEntryPoint(await entryPoint.getAddress(), 0xffffffffn, {
        value: stake,
      })
      .then((tx) => tx.wait())

    const WebAuthnSingletonSigner = await ethers.getContractFactory('TestWebAuthnSingletonSigner')
    const signer = await WebAuthnSingletonSigner.deploy()

    const navigator = {
      credentials: new WebAuthnCredentials(),
    }

    return {
      user,
      bundler,
      proxyFactory,
      safeModuleSetup,
      module,
      entryPoint,
      multiSend,
      singleton,
      verifier,
      stakedFactory,
      signer,
      navigator,
    }
  })

  it('should execute a user op and deploy a WebAuthn signer', async () => {
    const {
      user,
      bundler,
      proxyFactory,
      safeModuleSetup,
      module,
      entryPoint,
      multiSend,
      singleton,
      verifier,
      stakedFactory,
      signer,
      navigator,
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

    const initializer = singleton.interface.encodeFunctionData('setup', [
      [signer.target],
      1,
      multiSend.target,
      multiSend.interface.encodeFunctionData('multiSend', [
        encodeMultiSendTransactions([
          {
            op: 1 as const,
            to: safeModuleSetup.target,
            data: safeModuleSetup.interface.encodeFunctionData('enableModules', [[module.target]]),
          },
          {
            op: 0 as const,
            to: signer.target,
            data: signer.interface.encodeFunctionData('setOwner', [{ ...publicKey, verifiers: verifier.target }]),
          },
        ]),
      ]),
      module.target,
      ethers.ZeroAddress,
      0,
      ethers.ZeroAddress,
    ])
    const safeSalt = Date.now()
    const safeAddress = await proxyFactory.createProxyWithNonce.staticCall(singleton.target, initializer, safeSalt)
    const deployData = proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [singleton.target, initializer, safeSalt])
    const initCode = ethers.solidityPacked(['address', 'bytes'], [stakedFactory.target, deployData])

    const safeOp = buildSafeUserOpTransaction(
      safeAddress,
      user.address,
      ethers.parseEther('0.1'),
      '0x',
      await entryPoint.getNonce(safeAddress, 0),
      await entryPoint.getAddress(),
      false,
      false,
      {
        initCode,
        verificationGasLimit: 700000,
      },
    )
    const opHash = await module.getOperationHash(
      buildPackedUserOperationFromSafeUserOperation({
        safeOp,
        signature: '0x',
      }),
    )
    const assertion = navigator.credentials.get({
      publicKey: {
        challenge: ethers.getBytes(opHash),
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
    const userOp = await buildRpcUserOperationFromSafeUserOperation({
      safeOp,
      signature,
    })

    await user.sendTransaction({ to: safeAddress, value: ethers.parseEther('0.5') }).then((tx) => tx.wait())

    expect(ethers.dataLength(await ethers.provider.getCode(safeAddress))).to.equal(0)
    expect(await signer.getOwner(safeAddress)).to.deep.equal([0n, 0n, 0n])

    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())
    await waitForUserOp(userOp)

    expect(ethers.dataLength(await ethers.provider.getCode(safeAddress))).to.not.equal(0)
    expect(await ethers.provider.getBalance(safeAddress)).to.be.lessThan(ethers.parseEther('0.4'))
    expect(await signer.getOwner(safeAddress)).to.deep.equal([publicKey.x, publicKey.y, verifier.target])
  })
})
