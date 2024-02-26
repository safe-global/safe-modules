import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { bundlerRpc, encodeMultiSendTransactions, prepareAccounts, waitForUserOp } from '../utils/e2e'
import {
  UserVerificationRequirement,
  WebAuthnCredentials,
  extractClientDataFields,
  extractPublicKey,
  extractSignature,
} from '../utils/webauthn'
import { buildSafeUserOpTransaction, buildUserOperationFromSafeUserOperation } from '../../src/utils/userOp'
import { buildSignatureBytes } from '../../src/utils/execution'

describe('E2E - WebAuthn Singleton Signers', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { EntryPoint, Safe4337Module, SafeProxyFactory, SafeModuleSetup, MultiSend, SafeL2, WebAuthnVerifier } = await deployments.run()
    const [user] = await prepareAccounts()
    const bundler = bundlerRpc()

    const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
    const module = await ethers.getContractAt('Safe4337Module', Safe4337Module.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const safeModuleSetup = await ethers.getContractAt('SafeModuleSetup', SafeModuleSetup.address)
    const multiSend = await ethers.getContractAt('MultiSend', MultiSend.address)
    const singleton = await ethers.getContractAt('SafeL2', SafeL2.address)
    const webAuthnVerifier = await ethers.getContractAt('WebAuthnVerifier', WebAuthnVerifier.address)

    const TestStakedFactory = await ethers.getContractFactory('TestStakedFactory')
    const stakedFactory = await TestStakedFactory.deploy(proxyFactory.target)
    const stake = ethers.parseEther('1.0')
    await stakedFactory
      .stakeEntryPoint(await entryPoint.getAddress(), 0xffffffffn, {
        value: stake,
      })
      .then((tx) => tx.wait())

    const WebAuthnSingletonSigner = await ethers.getContractFactory('WebAuthnSingletonSigner')
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
      webAuthnVerifier,
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
      webAuthnVerifier,
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
    const publicKey = extractPublicKey(credential.response)

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
            data: signer.interface.encodeFunctionData('setOwner', [{ ...publicKey, verifier: webAuthnVerifier.target }]),
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
        verificationGasLimit: ethers.toBeHex(700000),
      },
    )
    const opHash = await module.getOperationHash(
      buildUserOperationFromSafeUserOperation({
        safeOp,
        signature: '0x',
      }),
    )
    const assertion = navigator.credentials.get({
      publicKey: {
        challenge: ethers.getBytes(opHash),
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
    const userOp = buildUserOperationFromSafeUserOperation({
      safeOp,
      signature,
    })

    await user.sendTransaction({ to: safeAddress, value: ethers.parseEther('0.5') }).then((tx) => tx.wait())

    expect(ethers.dataLength(await ethers.provider.getCode(safeAddress))).to.equal(0)
    expect(await signer.getOwner(safeAddress)).to.deep.equal([0n, 0n, ethers.ZeroAddress])

    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())
    await waitForUserOp(userOp)

    expect(ethers.dataLength(await ethers.provider.getCode(safeAddress))).to.not.equal(0)
    expect(await ethers.provider.getBalance(safeAddress)).to.be.lessThan(ethers.parseEther('0.4'))
    expect(await signer.getOwner(safeAddress)).to.deep.equal([publicKey.x, publicKey.y, webAuthnVerifier.target])
  })
})
