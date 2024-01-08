import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Safe4337 } from '../../src/utils/safe'

describe('InitCode', () => {
  const setupTests = async () => {
    const addr = (byte: number) => `0x${byte.toString(16).padStart(2, '0').repeat(20)}`
    const config = {
      safeSingleton: addr(0x01),
      entryPoint: addr(0x02),
      erc4337module: addr(0x03),
      proxyFactory: addr(0x04),
      addModulesLib: addr(0x05),
      proxyCreationCode: '0x',
      chainId: 42,
    }

    const InitCode = await ethers.getContractFactory('InitCode')
    const initCode = await InitCode.deploy(config)

    const owner = addr(0xff)
    const safe = await Safe4337.withSigner(owner, config)

    return {
      initCode,
      owner,
      safe,
    }
  }

  it('should compute the valid init code', async () => {
    const { initCode, owner, safe } = await setupTests()

    expect(await initCode.getInitCode([owner], 1, 0)).to.equal(safe.getInitCode())
  })
})
