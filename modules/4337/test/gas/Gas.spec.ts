import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getSafe4337Module, getEntryPoint, getFactory, getSafeModuleSetup, getSafeL2Singleton } from '../utils/setup'
import { buildSignatureBytes, logGas } from '../../src/utils/execution'
import { buildUserOperationFromSafeUserOperation, buildSafeUserOpTransaction, signSafeOp } from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { Safe4337 } from '../../src/utils/safe'

describe('Gas Metering', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()
    const { HariWillibaldToken, XanderBlazeNFT } = await deployments.run()

    const [user] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const module = await getSafe4337Module()
    const proxyFactory = await getFactory()
    const proxyCreationCode = await proxyFactory.proxyCreationCode()
    const safeModuleSetup = await getSafeModuleSetup()
    const singleton = await getSafeL2Singleton()
    const safe = await Safe4337.withSigner(user.address, {
      safeSingleton: await singleton.getAddress(),
      entryPoint: await entryPoint.getAddress(),
      erc4337module: await module.getAddress(),
      proxyFactory: await proxyFactory.getAddress(),
      safeModuleSetup: await safeModuleSetup.getAddress(),
      proxyCreationCode,
      chainId: Number(await chainId()),
    })
    const erc20Token = await ethers.getContractAt('HariWillibaldToken', HariWillibaldToken.address)
    const erc721Token = await ethers.getContractAt('XanderBlazeNFT', XanderBlazeNFT.address)

    return {
      user,
      entryPoint,
      validator: module,
      safe,
      erc20Token,
      erc721Token,
    }
  })

  describe('Safe Deployment + Enabling 4337 Module', () => {
    it('Safe with 4337 Module Deployment', async () => {
      const { user, entryPoint, validator, safe } = await setupTests()

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)

      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        safe.address, // No functions are called.
        0,
        '0x',
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )

      const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])

      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await logGas('Safe with 4337 Module Deployment', entryPoint.executeUserOp(userOp, 0))

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)
    })
  })

  describe('Safe Deployment + Enabling 4337 Module + Native Transfers', () => {
    it('Safe with 4337 Module Deployment + Native Transfer', async () => {
      const { user, entryPoint, validator, safe } = await setupTests()
      const amount = ethers.parseEther('0.00001')

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)
      await user.sendTransaction({
        to: safe.address,
        value: amount,
      })
      const safeBalBefore = await ethers.provider.getBalance(safe.address)
      expect(safeBalBefore).to.equal(amount)

      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        user.address,
        amount,
        '0x',
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )

      const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])

      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await logGas('Safe with 4337 Module Deployment + Native Transfer', entryPoint.executeUserOp(userOp, 0))

      const safeBalAfter = await ethers.provider.getBalance(safe.address)
      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)
      expect(safeBalAfter).to.equal(0)
    })

    it('Safe with 4337 Module Native Transfer', async () => {
      const { user, entryPoint, validator, safe } = await setupTests()

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)

      let safeOp = buildSafeUserOpTransaction(
        safe.address,
        safe.address,
        0,
        '0x',
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      let signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      let userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await entryPoint.executeUserOp(userOp, 0)
      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)

      // Now Native Transfer
      const amount = ethers.parseEther('0.00001')
      expect(await ethers.provider.getBalance(safe.address)).to.equal(0)
      await user.sendTransaction({
        to: safe.address,
        value: amount,
      })
      expect(await ethers.provider.getBalance(safe.address)).to.equal(amount)

      safeOp = buildSafeUserOpTransaction(
        safe.address,
        user.address,
        amount,
        '0x',
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await logGas('Safe with 4337 Module Native Transfer', entryPoint.executeUserOp(userOp, 0))

      expect(await ethers.provider.getBalance(safe.address)).to.equal(0)
    })
  })

  describe('Safe Deployment + Enabling 4337 Module + Token Operations', () => {
    it('Safe with 4337 Module Deployment + ERC20 Token Transfer', async () => {
      const { user, entryPoint, validator, safe, erc20Token } = await setupTests()

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)

      expect(await erc20Token.balanceOf(safe.address)).to.equal(0)
      await erc20Token.transfer(safe.address, ethers.parseUnits('4.2', 18)).then((tx) => tx.wait())
      expect(await erc20Token.balanceOf(safe.address)).to.equal(ethers.parseUnits('4.2', 18))

      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        await erc20Token.getAddress(),
        0,
        erc20Token.interface.encodeFunctionData('transfer', [user.address, await erc20Token.balanceOf(safe.address)]),
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )

      const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])

      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await logGas('Safe with 4337 Module Deployment + ERC20 Transfer', entryPoint.executeUserOp(userOp, 0))
      expect(await erc20Token.balanceOf(safe.address)).to.equal(0)
      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)
    })

    it('Safe with 4337 Module Deployment + ERC721 Token Minting', async () => {
      const { user, entryPoint, validator, safe, erc721Token } = await setupTests()
      const tokenID = 1

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)

      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        await erc721Token.getAddress(),
        0,
        erc721Token.interface.encodeFunctionData('safeMint', [safe.address, tokenID]),
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      expect(await erc721Token.balanceOf(safe.address)).to.equal(0)
      await logGas('Safe with 4337 Module Deployment + ERC721 Transfer', entryPoint.executeUserOp(userOp, 0))
      expect(await erc721Token.balanceOf(safe.address)).to.equal(1)
      expect(await erc721Token.ownerOf(tokenID)).to.equal(safe.address)
      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)
    })
  })

  describe('Token Operations Only', () => {
    it('Safe with 4337 Module ERC20 Token Transfer', async () => {
      const { user, entryPoint, validator, safe, erc20Token } = await setupTests()

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)

      let safeOp = buildSafeUserOpTransaction(
        safe.address,
        safe.address, // No functions are called.
        0,
        '0x',
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      let signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      let userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await entryPoint.executeUserOp(userOp, 0)
      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)

      // Now Token Transfer
      expect(await erc20Token.balanceOf(safe.address)).to.equal(0)
      await erc20Token.transfer(safe.address, ethers.parseUnits('4.2', 18)).then((tx) => tx.wait())
      expect(await erc20Token.balanceOf(safe.address)).to.equal(ethers.parseUnits('4.2', 18))

      safeOp = buildSafeUserOpTransaction(
        safe.address,
        await erc20Token.getAddress(),
        0,
        erc20Token.interface.encodeFunctionData('transfer', [user.address, await erc20Token.balanceOf(safe.address)]),
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await logGas('Safe with 4337 Module ERC20 Transfer', entryPoint.executeUserOp(userOp, 0))

      expect(await erc20Token.balanceOf(safe.address)).to.equal(0)
    })

    it('Safe with 4337 Module ERC721 Token Minting', async () => {
      const { user, entryPoint, validator, safe, erc721Token } = await setupTests()

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)

      let safeOp = buildSafeUserOpTransaction(
        safe.address,
        safe.address, // No functions are called.
        0,
        '0x',
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      let signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      let userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      await entryPoint.executeUserOp(userOp, 0)
      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)

      // Now ERC721 Token Transfer
      const tokenID = 1

      safeOp = buildSafeUserOpTransaction(
        safe.address,
        await erc721Token.getAddress(),
        0,
        erc721Token.interface.encodeFunctionData('safeMint', [safe.address, tokenID]),
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
        false,
        false,
        {
          initCode: safe.getInitCode(),
        },
      )
      signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      userOp = buildUserOperationFromSafeUserOperation({
        safeOp,
        signature,
      })

      expect(await erc721Token.balanceOf(safe.address)).to.equal(0)
      await logGas('Safe with 4337 Module ERC721 Transfer', entryPoint.executeUserOp(userOp, 0))
      expect(await erc721Token.balanceOf(safe.address)).to.equal(1)
      expect(await erc721Token.ownerOf(tokenID)).to.equal(safe.address)
    })
  })
})
