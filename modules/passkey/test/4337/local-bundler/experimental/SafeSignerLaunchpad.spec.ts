import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { packGasParameters, unpackUserOperation } from '@safe-global/safe-4337/dist/src/utils/userOp'
import { bundlerRpc, prepareAccounts, waitForUserOp } from '@safe-global/safe-4337-local-bundler'
import { WebAuthnCredentials } from '../../../utils/webauthnShim'
import { decodePublicKey, encodeWebAuthnSignature } from '../../../../src/utils/webauthn'

describe('Safe WebAuthn Signer Launchpad [@4337]', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const {
      EntryPoint,
      Safe4337Module,
      SafeSignerLaunchpad,
      SafeProxyFactory,
      SafeModuleSetup,
      SafeL2,
      FCLP256Verifier,
      SafeWebAuthnSignerFactory,
    } = await deployments.run()
    const [user] = await prepareAccounts()
    const bundler = bundlerRpc()

    const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
    const module = await ethers.getContractAt(Safe4337Module.abi, Safe4337Module.address)
    const proxyFactory = await ethers.getContractAt(SafeProxyFactory.abi, SafeProxyFactory.address)
    const safeModuleSetup = await ethers.getContractAt(SafeModuleSetup.abi, SafeModuleSetup.address)
    const signerLaunchpad = await ethers.getContractAt('SafeSignerLaunchpad', SafeSignerLaunchpad.address)
    const singleton = await ethers.getContractAt(SafeL2.abi, SafeL2.address)
    const verifier = await ethers.getContractAt('IP256Verifier', FCLP256Verifier.address)
    const signerFactory = await ethers.getContractAt('SafeWebAuthnSignerFactory', SafeWebAuthnSignerFactory.address)

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
      signerLaunchpad,
      singleton,
      signerFactory,
      navigator,
      verifier,
      SafeL2,
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
      signerLaunchpad,
      singleton,
      signerFactory,
      navigator,
      verifier,
      SafeL2,
    } = await setupTests()

    const { chainId } = await ethers.provider.getNetwork()
    const verifiers = ethers.solidityPacked(['uint16', 'address'], [0, await verifier.getAddress()])

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
    const signerAddress = await signerFactory.getSigner(publicKey.x, publicKey.y, verifiers)

    const launchpadInitializer = signerLaunchpad.interface.encodeFunctionData('setup', [
      singleton.target,
      signerFactory.target,
      publicKey.x,
      publicKey.y,
      verifiers,
      safeModuleSetup.target,
      safeModuleSetup.interface.encodeFunctionData('enableModules', [[module.target]]),
      module.target,
    ])
    const safeSalt = Date.now()
    const safe = await proxyFactory.createProxyWithNonce.staticCall(signerLaunchpad.target, launchpadInitializer, safeSalt)

    const packedUserOp = {
      sender: safe,
      nonce: ethers.toBeHex(await entryPoint.getNonce(safe, 0)),
      initCode: ethers.solidityPacked(
        ['address', 'bytes'],
        [
          proxyFactory.target,
          proxyFactory.interface.encodeFunctionData('createProxyWithNonce', [signerLaunchpad.target, launchpadInitializer, safeSalt]),
        ],
      ),
      callData: signerLaunchpad.interface.encodeFunctionData('promoteAccountAndExecuteUserOp', [
        signerFactory.target,
        publicKey.x,
        publicKey.y,
        verifiers,
        user.address,
        ethers.parseEther('0.5'),
        '0x',
        0,
      ]),
      ...packGasParameters({
        verificationGasLimit: 700000,
        callGasLimit: 2000000,
        maxFeePerGas: 10000000000,
        maxPriorityFeePerGas: 10000000000,
      }),
      preVerificationGas: ethers.toBeHex(60000),
      paymasterAndData: '0x',
      signature: '0x',
    }

    const safeInitOp = {
      userOpHash: await entryPoint.getUserOpHash(packedUserOp),
      validAfter: 0,
      validUntil: 0,
      entryPoint: entryPoint.target,
    }
    const safeInitOpHash = ethers.TypedDataEncoder.hash(
      { verifyingContract: await signerLaunchpad.getAddress(), chainId },
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
    expect(await signerLaunchpad.getOperationHash(safeInitOp.userOpHash, safeInitOp.validAfter, safeInitOp.validUntil)).to.equal(
      safeInitOpHash,
    )

    const assertion = navigator.credentials.get({
      publicKey: {
        challenge: ethers.getBytes(safeInitOpHash),
        rpId: 'safe.global',
        allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
        userVerification: 'required',
      },
    })
    const signature = ethers.solidityPacked(
      ['uint48', 'uint48', 'bytes'],
      [safeInitOp.validAfter, safeInitOp.validUntil, encodeWebAuthnSignature(assertion.response)],
    )

    await user.sendTransaction({ to: safe, value: ethers.parseEther('1') }).then((tx) => tx.wait())
    expect(await ethers.provider.getBalance(safe)).to.equal(ethers.parseEther('1'))
    expect(await ethers.provider.getCode(safe)).to.equal('0x')
    expect(await ethers.provider.getCode(signerAddress)).to.equal('0x')

    const userOp = await unpackUserOperation({ ...packedUserOp, signature })
    await bundler.sendUserOperation(userOp, await entryPoint.getAddress())
    await waitForUserOp(userOp)

    expect(await ethers.provider.getBalance(safe)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    expect(await ethers.provider.getCode(safe)).to.not.equal('0x')
    expect(await ethers.provider.getCode(signerAddress)).to.not.equal('0x')

    const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
    expect(implementation).to.equal(singleton.target)

    const safeInstance = await ethers.getContractAt(SafeL2.abi, safe)
    expect(await safeInstance.getOwners()).to.deep.equal([signerAddress])
  })
})
