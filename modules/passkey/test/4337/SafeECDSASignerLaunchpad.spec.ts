import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'

import * as ERC1271 from '../utils/erc1271'

describe('SafeECDSASignerLaunchpad', () => {
  const setupTests = deployments.createFixture(async () => {
    const { EntryPoint, SafeECDSASignerLaunchpad, SafeProxyFactory } = await deployments.run()

    const entryPoint = await ethers.getContractAt('IEntryPoint', EntryPoint.address)
    const proxyFactory = await ethers.getContractAt(SafeProxyFactory.abi, SafeProxyFactory.address)
    const signerLaunchpad = await ethers.getContractAt('SafeECDSASignerLaunchpad', SafeECDSASignerLaunchpad.address)

    const entryPointImpersonator = await ethers.getImpersonatedSigner(EntryPoint.address)

    return {
      entryPoint,
      entryPointImpersonator,
      proxyFactory,
      signerLaunchpad,
    }
  })

  describe('constructor', function () {
    it('Should set immutables', async () => {
      const { entryPoint, signerLaunchpad } = await setupTests()

      expect(await signerLaunchpad.SUPPORTED_ENTRYPOINT()).to.equal(entryPoint.target)
    })
  })
})
