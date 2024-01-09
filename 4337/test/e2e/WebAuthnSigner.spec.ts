import { expect } from 'chai'
import CBOR from 'cbor'
import { deployments, ethers, network } from 'hardhat'
import { bundlerRpc, prepareAccounts, waitForUserOp } from '../utils/e2e'
import { chainId } from '../utils/encoding'
import { AuthenticatorAttestationResponse, WebAuthnCredentials, base64UrlEncode } from '../utils/webauthn'

describe('E2E - WebAuthn Signers', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { EntryPoint, Safe4337Module, SafeSignerLaunchpad, SafeProxyFactory, AddModulesLib, SafeL2, MultiSend } = await deployments.run()
    const [user] = await prepareAccounts()
    const bundler = bundlerRpc()

    const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
    const module = await ethers.getContractAt('Safe4337Module', Safe4337Module.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const addModulesLib = await ethers.getContractAt('AddModulesLib', AddModulesLib.address)
    const signerLaunchpad = await ethers.getContractAt('SafeSignerLaunchpad', SafeSignerLaunchpad.address)
    const singleton = await ethers.getContractAt('SafeL2', SafeL2.address)
    const multiSend = await ethers.getContractAt('MultiSend', MultiSend.address)

    const WebAuthnSignerFactory = await ethers.getContractFactory('WebAuthnSignerFactory')
    const signerFactory = await WebAuthnSignerFactory.deploy()

    const navigator = {
      credentials: new WebAuthnCredentials(),
    }

    return {
      user,
      bundler,
      proxyFactory,
      addModulesLib,
      module,
      entryPoint,
      signerLaunchpad,
      singleton,
      multiSend,
      signerFactory,
      navigator,
    }
  })

  it('should execute a user op and deploy a WebAuthn signer', async () => {
    const { user, bundler, proxyFactory, addModulesLib, module, entryPoint, signerLaunchpad, singleton, signerFactory, navigator } =
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
    const publicKey = extractPublicKey(credential.response)
    const signerData = ethers.solidityPacked(['uint256', 'uint256'], [publicKey.x, publicKey.y])
    const signerAddress = await signerFactory.getSigner(signerData)

    const safeInit = {
      singleton: singleton.target,
      signerFactory: signerFactory.target,
      signerData,
      setupTo: addModulesLib.target,
      setupData: addModulesLib.interface.encodeFunctionData('enableModules', [[module.target]]),
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
      callGasLimit: ethers.toBeHex(2000000),
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
      },
    })
    const signature = ethers.solidityPacked(
      ['uint48', 'uint48', 'bytes'],
      [
        safeInitOp.validAfter,
        safeInitOp.validUntil,
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes', 'bytes', 'uint256', 'uint256[2]'],
          [
            new Uint8Array(assertion.response.authenticatorData),
            new Uint8Array(assertion.response.clientDataJSON),
            extractChallengeOffset(assertion.response, safeInitOpHash),
            extractSignature(assertion.response),
          ],
        ),
      ],
    )

    await user.sendTransaction({ to: safe, value: ethers.parseEther('1') }).then((tx) => tx.wait())
    expect(await ethers.provider.getBalance(safe)).to.equal(ethers.parseEther('1'))
    expect(await ethers.provider.getCode(safe)).to.equal('0x')
    expect(await ethers.provider.getCode(signerAddress)).to.equal('0x')

    await bundler.sendUserOperation({ ...userOp, signature }, await entryPoint.getAddress())

    await waitForUserOp(userOp)
    expect(await ethers.provider.getBalance(safe)).to.be.lessThanOrEqual(ethers.parseEther('0.5'))
    expect(await ethers.provider.getCode(safe)).to.not.equal('0x')
    expect(await ethers.provider.getCode(signerAddress)).to.not.equal('0x')

    const [implementation] = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await ethers.provider.getStorage(safe, 0))
    expect(implementation).to.equal(singleton.target)

    const safeInstance = await ethers.getContractAt('SafeL2', safe)
    expect(await safeInstance.getOwners()).to.deep.equal([signerAddress])
  })

  /**
   * Extract the x and y coordinates of the public key from a created public key credential.
   * Inspired from <https://webauthn.guide/#registration>.
   */
  function extractPublicKey(response: AuthenticatorAttestationResponse): { x: bigint; y: bigint } {
    const attestationObject = CBOR.decode(response.attestationObject)
    const authDataView = new DataView(attestationObject.authData.buffer)
    const credentialIdLength = authDataView.getUint16(53)
    const cosePublicKey = attestationObject.authData.slice(55 + credentialIdLength)
    const key: Map<number, unknown> = CBOR.decode(cosePublicKey)
    const bn = (bytes: Uint8Array) => BigInt(ethers.hexlify(bytes))
    return {
      x: bn(key.get(-2) as Uint8Array),
      y: bn(key.get(-3) as Uint8Array),
    }
  }

  /**
   * Compute the challenge offset in the client data JSON. This is the offset, in bytes, of the
   * value associated with the `challenge` key in the JSON blob.
   */
  function extractChallengeOffset(response: AuthenticatorAssertionResponse, challenge: string): number {
    const clientDataJSON = new TextDecoder('utf-8').decode(response.clientDataJSON)

    const encodedChallenge = base64UrlEncode(challenge)
    const offset = clientDataJSON.indexOf(encodedChallenge)
    if (offset < 0) {
      throw new Error('challenge not found in client data JSON')
    }

    return offset
  }

  /**
   * Extracts the signature into R and S values from the authenticator response.
   *
   * See:
   * - <https://datatracker.ietf.org/doc/html/rfc3279#section-2.2.3>
   * - <https://en.wikipedia.org/wiki/X.690#BER_encoding>
   */
  function extractSignature(response: AuthenticatorAssertionResponse): [bigint, bigint] {
    const check = (x: boolean) => {
      if (!x) {
        throw new Error('invalid signature encoding')
      }
    }

    // Decode the DER signature. Note that we assume that all lengths fit into 8-bit integers,
    // which is true for the kinds of signatures we are decoding but generally false. I.e. this
    // code should not be used in any serious application.
    const view = new DataView(response.signature)

    // check that the sequence header is valid
    check(view.getUint8(0) === 0x30)
    check(view.getUint8(1) === view.byteLength - 2)

    // read r and s
    const readInt = (offset: number) => {
      check(view.getUint8(offset) === 0x02)
      const len = view.getUint8(offset + 1)
      const start = offset + 2
      const end = start + len
      const n = BigInt(ethers.hexlify(new Uint8Array(view.buffer.slice(start, end))))
      check(n < ethers.MaxUint256)
      return [n, end] as const
    }
    const [r, sOffset] = readInt(2)
    const [s] = readInt(sOffset)

    return [r, s]
  }
})
