import { p256 } from '@noble/curves/p256'
import assert from 'assert'
import { BigNumberish, BytesLike, ethers } from 'ethers'

export const DEFAULT_PRIVATE_KEY = BigInt(ethers.id('secret'))

export class Account {
  public privateKey: bigint
  public publicKey: { x: bigint; y: bigint }

  constructor(privateKey: BigNumberish = DEFAULT_PRIVATE_KEY) {
    this.privateKey = p256.utils.normPrivateKeyToScalar(BigInt(privateKey))

    const encodedPublicKey = p256.getPublicKey(this.privateKey, false)
    this.publicKey = {
      x: BigInt(ethers.hexlify(encodedPublicKey.subarray(1, 33))),
      y: BigInt(ethers.hexlify(encodedPublicKey.subarray(33, 65))),
    }
  }

  public sign(message: BytesLike) {
    const hex = ethers.hexlify(message).slice(2)
    const { r, s } = p256.sign(hex, this.privateKey, {
      lowS: true,
      prehash: false,
    })

    const highS = p256.CURVE.n - s
    assert(s < highS, 'signature s values are correctly ordered')

    return { r, s, highS }
  }
}
