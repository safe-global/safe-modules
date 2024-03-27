import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { WebAuthnCredentials, decodePublicKey } from '../utils/webauthn'
import { buildSignatureBytes } from '@safe-global/safe-4337/src/utils/execution'
import { extractClientDataFields, extractSignature } from '@safe-global/safe-4337/test/utils/webauthn'
import { buildSafeTransaction } from '../utils/safe'

describe('Offchain Passkey Signature Verification [@userstory]', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    const { SafeProxyFactory, SafeL2, FCLP256Verifier, WebAuthnSignerFactory } = await deployments.run()

    const proxyFactory = await ethers.getContractAt(SafeProxyFactory.abi, SafeProxyFactory.address)
    const singleton = await ethers.getContractAt(SafeL2.abi, SafeL2.address)
    const verifier = await ethers.getContractAt('IP256Verifier', FCLP256Verifier.address)
    const signerFactory = await ethers.getContractAt('WebAuthnSignerFactory', WebAuthnSignerFactory.address)

    const navigator = {
      credentials: new WebAuthnCredentials(),
    }

    return {
      proxyFactory,
      singleton,
      signerFactory,
      navigator,
      verifier,
      SafeL2,
    }
  })

  it('should be possible to verify offchain passkey signature', async () => {
    const { proxyFactory, singleton, signerFactory, navigator, verifier, SafeL2 } = await setupTests()

    const verifierAddress = await verifier.getAddress()

    // Creating the credentials for Passkey.
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

    // Getting the publicKey from the credential and creating the signer.
    const publicKey = decodePublicKey(credential.response)
    await signerFactory.createSigner(publicKey.x, publicKey.y, verifierAddress)

    // Querying the signer.
    const signerAddress = await signerFactory.getSigner(publicKey.x, publicKey.y, verifierAddress)
    const signer = await ethers.getContractAt('WebAuthnSigner', signerAddress)

    // Deploying Safe with the signer as a Single Owner.
    const singletonAddress = await singleton.getAddress()
    const setupData = singleton.interface.encodeFunctionData('setup', [
      [signerAddress],
      1,
      ethers.ZeroAddress,
      '0x',
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      0,
      ethers.ZeroAddress,
    ])
    const safeAddress = await proxyFactory.createProxyWithNonce.staticCall(singletonAddress, setupData, 0)
    await proxyFactory.createProxyWithNonce(singletonAddress, setupData, 0).then((tx: any) => tx.wait())
    const safe = await ethers.getContractAt(SafeL2.abi, safeAddress)

    // Calling `checkSignatures(...)` (With passkey signed dataHash - EIP1271) on the created Safe and check it doesn't revert.
    const nonce = await safe.nonce()
    const randomAddress = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)))
    const safeTx = buildSafeTransaction({ to: randomAddress, value: 1n, nonce: nonce })
    const safeTxData = await safe.encodeTransactionData.staticCall(
      safeTx.to,
      safeTx.value,
      safeTx.data,
      safeTx.operation,
      safeTx.safeTxGas,
      safeTx.baseGas,
      safeTx.gasPrice,
      safeTx.gasToken,
      safeTx.refundReceiver,
      safeTx.nonce,
    )
    const safeTxHash = ethers.keccak256(safeTxData)

    const assertion = navigator.credentials.get({
      publicKey: {
        challenge: ethers.getBytes(safeTxHash),
        rpId: 'safe.global',
        allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.rawId) }],
        userVerification: 'required',
      },
    })

    // Creating the signature for the safeTxHash.
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

    expect(await safe.checkSignatures(safeTxHash, safeTxData, signature)).not.to.be.reverted
  })
})
