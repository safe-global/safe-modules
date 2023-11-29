import { expect } from 'chai'
import { deployments, ethers } from 'hardhat'
import { getSafe4337Module, getEntryPoint, getFactory, getAddModulesLib, getSafeL2Singleton } from '../utils/setup'
import { buildSignatureBytes, logGas } from '../../src/utils/execution'
import { buildUserOperationFromSafeUserOperation, buildSafeUserOpTransaction, signSafeOp } from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { SafeConfig, Safe4337, GlobalConfig, buildInitParamsForConfig } from '../../src/utils/safe'

describe('Gas Metering', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()
    const { HariWillibaldToken, TestERC721Token } = await deployments.run()

    const [user] = await ethers.getSigners()
    const entryPoint = await getEntryPoint()
    const module = await getSafe4337Module()
    const proxyFactory = await getFactory()
    const proxyCreationCode = await proxyFactory.proxyCreationCode()
    const addModulesLib = await getAddModulesLib()
    const singleton = await getSafeL2Singleton()
    const erc20Token = await ethers.getContractAt('HariWillibaldToken', HariWillibaldToken.address)
    const erc721Token = await ethers.getContractAt('TestERC721Token', TestERC721Token.address)

    return {
      user,
      entryPoint,
      module,
      validator: module,
      proxyFactory,
      proxyCreationCode,
      addModulesLib,
      singleton,
      erc20Token,
      erc721Token,
    }
  })

  describe('Safe Deployment + Enabling 4337 Module', () => {
    it('Safe with 4337 Module Deployment', async () => {
      const { user, entryPoint, module, validator, proxyFactory, proxyCreationCode, addModulesLib, singleton } = await setupTests()

      const safeConfig: SafeConfig = {
        signers: [user.address],
        threshold: 1,
        nonce: 0,
      }

      const globalConfig: GlobalConfig = {
        safeSingleton: await singleton.getAddress(),
        entryPoint: await entryPoint.getAddress(),
        erc4337module: await module.getAddress(),
        proxyFactory: await proxyFactory.getAddress(),
        proxyCreationCode,
        addModulesLib: await addModulesLib.getAddress(),
        chainId: Number(await chainId()),
      }

      const initParams = buildInitParamsForConfig(safeConfig, globalConfig)

      const safe = new Safe4337(initParams.safeAddress, globalConfig, safeConfig)
      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)

      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        safe.address, // No functions are called.
        0,
        '0x',
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
      )

      const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])

      const userOp = buildUserOperationFromSafeUserOperation({
        safeAddress: safe.address,
        safeOp,
        signature,
        initCode: safe.getInitCode(),
      })

      await logGas('Safe with 4337 Module Deployment', entryPoint.executeUserOp(userOp, 0))

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)
    })
  })

  describe('Safe Deployment + Enabling 4337 Module + Token Operations', () => {
    it('Safe with 4337 Module Deployment + ERC20 Token Transfer', async () => {
      const { user, entryPoint, module, validator, proxyFactory, proxyCreationCode, addModulesLib, singleton, erc20Token } =
        await setupTests()

      const safeConfig: SafeConfig = {
        signers: [user.address],
        threshold: 1,
        nonce: 0,
      }

      const globalConfig: GlobalConfig = {
        safeSingleton: await singleton.getAddress(),
        entryPoint: await entryPoint.getAddress(),
        erc4337module: await module.getAddress(),
        proxyFactory: await proxyFactory.getAddress(),
        proxyCreationCode,
        addModulesLib: await addModulesLib.getAddress(),
        chainId: Number(await chainId()),
      }

      const initParams = buildInitParamsForConfig(safeConfig, globalConfig)

      const safe = new Safe4337(initParams.safeAddress, globalConfig, safeConfig)
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
      )

      const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])

      const userOp = buildUserOperationFromSafeUserOperation({
        safeAddress: safe.address,
        safeOp,
        signature,
        initCode: safe.getInitCode(),
      })

      await logGas('Safe with 4337 Module Deployment + ERC20 Transfer', entryPoint.executeUserOp(userOp, 0))
      expect(await erc20Token.balanceOf(safe.address)).to.equal(0)
      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.not.equal(0)
    })

    it('Safe with 4337 Module Deployment + ERC721 Token Minting', async () => {
      const { user, entryPoint, module, validator, proxyFactory, proxyCreationCode, addModulesLib, singleton, erc721Token } =
        await setupTests()

      const safeConfig: SafeConfig = {
        signers: [user.address],
        threshold: 1,
        nonce: 0,
      }

      const globalConfig: GlobalConfig = {
        safeSingleton: await singleton.getAddress(),
        entryPoint: await entryPoint.getAddress(),
        erc4337module: await module.getAddress(),
        proxyFactory: await proxyFactory.getAddress(),
        proxyCreationCode,
        addModulesLib: await addModulesLib.getAddress(),
        chainId: Number(await chainId()),
      }

      const initParams = buildInitParamsForConfig(safeConfig, globalConfig)

      const tokenID = 1

      const safe = new Safe4337(initParams.safeAddress, globalConfig, safeConfig)

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)

      const safeOp = buildSafeUserOpTransaction(
        safe.address,
        await erc721Token.getAddress(),
        0,
        erc721Token.interface.encodeFunctionData('safeMint', [safe.address, tokenID]),
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
      )
      const signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      const userOp = buildUserOperationFromSafeUserOperation({
        safeAddress: safe.address,
        safeOp,
        signature,
        initCode: safe.getInitCode(),
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
      const { user, entryPoint, module, validator, proxyFactory, proxyCreationCode, addModulesLib, singleton, erc20Token } =
        await setupTests()

      const safeConfig: SafeConfig = {
        signers: [user.address],
        threshold: 1,
        nonce: 0,
      }

      const globalConfig: GlobalConfig = {
        safeSingleton: await singleton.getAddress(),
        entryPoint: await entryPoint.getAddress(),
        erc4337module: await module.getAddress(),
        proxyFactory: await proxyFactory.getAddress(),
        proxyCreationCode,
        addModulesLib: await addModulesLib.getAddress(),
        chainId: Number(await chainId()),
      }

      const initParams = buildInitParamsForConfig(safeConfig, globalConfig)

      const safe = new Safe4337(initParams.safeAddress, globalConfig, safeConfig)

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)

      let safeOp = buildSafeUserOpTransaction(
        safe.address,
        safe.address, // No functions are called.
        0,
        '0x',
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
      )
      let signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      let userOp = buildUserOperationFromSafeUserOperation({
        safeAddress: safe.address,
        safeOp,
        signature,
        initCode: safe.getInitCode(),
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
      )
      signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      userOp = buildUserOperationFromSafeUserOperation({
        safeAddress: safe.address,
        safeOp,
        signature,
        initCode: safe.getInitCode(),
      })

      await logGas('Safe with 4337 Module ERC20 Transfer', entryPoint.executeUserOp(userOp, 0))

      expect(await erc20Token.balanceOf(safe.address)).to.equal(0)
    })

    it('Safe with 4337 Module ERC721 Token Minting', async () => {
      const { user, entryPoint, module, validator, proxyFactory, proxyCreationCode, addModulesLib, singleton, erc721Token } =
        await setupTests()

      const safeConfig: SafeConfig = {
        signers: [user.address],
        threshold: 1,
        nonce: 0,
      }

      const globalConfig: GlobalConfig = {
        safeSingleton: await singleton.getAddress(),
        entryPoint: await entryPoint.getAddress(),
        erc4337module: await module.getAddress(),
        proxyFactory: await proxyFactory.getAddress(),
        proxyCreationCode,
        addModulesLib: await addModulesLib.getAddress(),
        chainId: Number(await chainId()),
      }

      const initParams = buildInitParamsForConfig(safeConfig, globalConfig)

      const safe = new Safe4337(initParams.safeAddress, globalConfig, safeConfig)

      expect(ethers.dataLength(await ethers.provider.getCode(safe.address))).to.equal(0)

      let safeOp = buildSafeUserOpTransaction(
        safe.address,
        safe.address, // No functions are called.
        0,
        '0x',
        await entryPoint.getNonce(safe.address, 0),
        await entryPoint.getAddress(),
      )
      let signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      let userOp = buildUserOperationFromSafeUserOperation({
        safeAddress: safe.address,
        safeOp,
        signature,
        initCode: safe.getInitCode(),
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
      )
      signature = buildSignatureBytes([await signSafeOp(user, await validator.getAddress(), safeOp, await chainId())])
      userOp = buildUserOperationFromSafeUserOperation({
        safeAddress: safe.address,
        safeOp,
        signature,
        initCode: safe.getInitCode(),
      })

      expect(await erc721Token.balanceOf(safe.address)).to.equal(0)
      await logGas('Safe with 4337 Module ERC721 Transfer', entryPoint.executeUserOp(userOp, 0))
      expect(await erc721Token.balanceOf(safe.address)).to.equal(1)
      expect(await erc721Token.ownerOf(tokenID)).to.equal(safe.address)
    })
  })
})
