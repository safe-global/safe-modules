import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { WebAuthnCredentials, decodePublicKey, encodeWebAuthnSignature } from '../utils/webauthn'
import { buildSignatureBytes } from '@safe-global/safe-4337/src/utils/execution'

describe('Offchain Passkey Signature Verification [@userstory]', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { SafeProxyFactory, SafeL2, FCLP256Verifier, WebAuthnSignerFactory, CompatibilityFallbackHandler } = await deployments.run()

    const proxyFactory = await ethers.getContractAt(SafeProxyFactory.abi, SafeProxyFactory.address)
    const singleton = await ethers.getContractAt(SafeL2.abi, SafeL2.address)
    const fallbackHandler = await ethers.getContractAt(CompatibilityFallbackHandler.abi, CompatibilityFallbackHandler.address)
    const verifier = await ethers.getContractAt('IP256Verifier', FCLP256Verifier.address)
    const signerFactory = await ethers.getContractAt('WebAuthnSignerFactory', WebAuthnSignerFactory.address)

    const navigator = {
      credentials: new WebAuthnCredentials(),
    }

    // Create the credentials for Passkey.
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

    const verifierAddress = await verifier.getAddress()

    // Get the publicKey from the credential and create the signer.
    const publicKey = decodePublicKey(credential.response)
    await signerFactory.createSigner(publicKey.x, publicKey.y, verifierAddress)
    const signerAddress = await signerFactory.getSigner(publicKey.x, publicKey.y, verifierAddress)
    const signer = await ethers.getContractAt('WebAuthnSigner', signerAddress)

    // Deploy Safe with the WebAuthn signer as a single owner.
    const singletonAddress = await singleton.getAddress()
    const setupData = singleton.interface.encodeFunctionData('setup', [
      [signerAddress],
      1,
      ethers.ZeroAddress,
      '0x',
      await fallbackHandler.getAddress(),
      ethers.ZeroAddress,
      0,
      ethers.ZeroAddress,
    ])
    const safeAddress = await proxyFactory.createProxyWithNonce.staticCall(singletonAddress, setupData, 0)
    await proxyFactory.createProxyWithNonce(singletonAddress, setupData, 0)
    const safe = await ethers.getContractAt([...SafeL2.abi, ...CompatibilityFallbackHandler.abi], safeAddress)

    return {
      safe,
      signer,
      navigator,
      credential,
    }
  })

  it('should be possible to verify offchain passkey signature', async () => {
    const { safe, signer, navigator, credential } = await setupTests()

    // Define message to be signed. The message should be a 32 byte hash of some data as shown below.
    const message = ethers.id("Signature verification with passkeys is cool!")

    // Compute the `SafeMessage` hash which gets specified as the challenge and ultimately signed by the private key.
    const { chainId } = await ethers.provider.getNetwork()
    const safeMsgData = ethers.TypedDataEncoder.encode(
      { verifyingContract: await safe.getAddress(), chainId },
      { SafeMessage: [{name: 'message', type: 'bytes'}] },
      { message }
    )
    const safeMsgHash = ethers.keccak256(safeMsgData)

    // Creating the signature for the `safeMsgHash`.
    const assertion = navigator.credentials.get({
      publicKey: {
        challenge: ethers.getBytes(safeMsgHash),
        rpId: 'safe.global',
        allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
        userVerification: 'required',
      },
    })

    // Encode the passkey signature for the safe.
    const signature = buildSignatureBytes([
      {
        signer: await signer.getAddress(),
        data: encodeWebAuthnSignature(assertion.response),
        dynamic: true,
      },
    ])

    expect(await safe['isValidSignature(bytes32,bytes)'](message, signature)).to.eq('0x1626ba7e')
  })
})