import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { buildSignatureBytes, signHash } from '../../src/utils/execution'

describe('TestSafe4337Module', () => {
  const setupTests = deployments.createFixture(async () => {
    const module = await ethers.deployContract('TestSafe4337Module', [ethers.hexlify(ethers.randomBytes(20))])
    return { module }
  })

  it('Safe with 1 EOA owner', async () => {
    const { module } = await setupTests()
    const [user] = await ethers.getSigners()

    const safeOpHash = ethers.hexlify(ethers.randomBytes(32))

    const signature = buildSignatureBytes([await signHash(user, safeOpHash)])

    const threshold = 1
    expect(await module.checkSignatureLength(signature, threshold)).to.be.true
  })

  it('Safe with 1 Safe as owner', async () => {
    const { module } = await setupTests()

    const signature = buildSignatureBytes([
      {
        signer: ethers.ZeroAddress,
        data: ethers.hexlify(ethers.randomBytes(65)),
        dynamic: true,
      },
    ])

    const threshold = 1
    expect(await module.checkSignatureLength(signature, threshold)).to.be.true
  })

  it('Safe with 1 EOA and 1 Safe as owners', async () => {
    const { module } = await setupTests()
    const [user] = await ethers.getSigners()

    const safeOpHash = ethers.hexlify(ethers.randomBytes(32))

    const signature = buildSignatureBytes([
      await signHash(user, safeOpHash),
      {
        signer: ethers.ZeroAddress,
        data: ethers.hexlify(ethers.randomBytes(65)),
        dynamic: true,
      },
    ])

    const threshold = 2
    expect(await module.checkSignatureLength(signature, threshold)).to.be.true
  })

  it('Safe with 2 EOA and 1 Safe as owners', async () => {
    const { module } = await setupTests()
    const [user] = await ethers.getSigners()

    let safeOpHash = ethers.hexlify(ethers.randomBytes(32))

    const signature = buildSignatureBytes([
      await signHash(user, safeOpHash),
      await signHash(user, safeOpHash),
      {
        signer: ethers.ZeroAddress,
        data: ethers.hexlify(ethers.randomBytes(65)),
        dynamic: true,
      },
    ])

    const threshold = 3
    expect(await module.checkSignatureLength(signature, threshold)).to.be.true
  })

  it('Safe with 1 EOA and 2 Safe as owners', async () => {
    const { module } = await setupTests()
    const [user] = await ethers.getSigners()

    let safeOpHash = ethers.hexlify(ethers.randomBytes(32))

    const signature = buildSignatureBytes([
      await signHash(user, safeOpHash),
      {
        signer: ethers.ZeroAddress,
        data: ethers.hexlify(ethers.randomBytes(65)),
        dynamic: true,
      },
      {
        signer: ethers.ZeroAddress,
        data: ethers.hexlify(ethers.randomBytes(65)),
        dynamic: true,
      },
    ])

    const threshold = 3
    expect(await module.checkSignatureLength(signature, threshold)).to.be.true
  })

  it('Should revert when signature contains additional bytes', async () => {
    const { module } = await setupTests()
    const [user] = await ethers.getSigners()

    let safeOpHash = ethers.hexlify(ethers.randomBytes(32))

    const signature = buildSignatureBytes([
      await signHash(user, safeOpHash),
      {
        signer: ethers.ZeroAddress,
        data: ethers.hexlify(ethers.randomBytes(65)),
        dynamic: true,
      },
      {
        signer: ethers.ZeroAddress,
        data: ethers.hexlify(ethers.randomBytes(65)),
        dynamic: true,
      },
    ]).concat('00')

    const threshold = 3
    expect(await module.checkSignatureLength(signature, threshold)).to.be.false
  })
})
