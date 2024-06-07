import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { getEntryPoint, getTestSafe } from "./utils/setup";
import { getPluginManifest } from "./utils/dataTypes";

describe("Safe6900Module", function () {
  const IPLUGIN_INTERFACEID = "0xf23b1ed7";

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const ModuleDeployment = await deployments.get('Safe6900Module')
    const [user1] = await ethers.getSigners()
    const module = await ethers.getContractAt('Safe6900Module', ModuleDeployment.address)
    // const safe = await ethers.getContractAt('Safe', (await deployments.get('Safe')).address)
    const entryPoint = await getEntryPoint()
    const safe = await getTestSafe(user1, await module.getAddress(), await module.getAddress())

    return {
      safe,
      module,
      entryPoint
    }
  })

  describe("Plugin management", () => {

    describe("Install plugin", () => {
      it("Install plugin only once", async () => {
        const { safe, module } = await setupTests();

        const mockPlugin = await ethers.deployContract("MockContract");

        await mockPlugin.givenMethodReturnBool("0x01ffc9a7", true);
        const manifest = getPluginManifest();
        const manifestHash = ethers.keccak256(manifest);
        // pluginManifest() => 0xc7763130

        await mockPlugin.givenMethodReturn("0xc7763130", manifest);

        const pluginInstallData = ethers.randomBytes(64);

        const installData = module.interface.encodeFunctionData('installPlugin', [mockPlugin.target, manifestHash, pluginInstallData, []]);

        expect(await safe.exec(safe.target, 0, installData)).to.emit(module, "PluginInstalled").withArgs(mockPlugin.target, manifestHash, []);
        expect(await module.installedPlugins(safe.target, mockPlugin.target)).to.be.equal(1n);

        await expect(safe.exec(safe.target, 0, installData)).to.be.revertedWithCustomError(module, "PluginAlreadyInstalled");
      })

      it("Reverts if plugin does not implement IERC165 interface", async () => {
        const { safe, module } = await setupTests();

        const mockPlugin = await ethers.deployContract("MockContract");
        await mockPlugin.givenMethodReturnBool("0x01ffc9a7", false);

        const manifest = getPluginManifest();
        const manifestHash = ethers.keccak256(manifest);

        const pluginInstallData = ethers.randomBytes(64);

        const installData = module.interface.encodeFunctionData('installPlugin', [mockPlugin.target, manifestHash, pluginInstallData, []]);

        await expect(safe.exec(safe.target, 0, installData)).to.be.revertedWithCustomError(module, "PluginInterfaceNotSupported").withArgs(mockPlugin.target);

      })

      it("Reverts if plugin does not support IERC165 interface", async () => {
        const { safe, module } = await setupTests();

        const mockPlugin = await ethers.deployContract("MockContract");
        await mockPlugin.givenMethodReturnBool("0x01ffc9a7", false);

        const manifest = getPluginManifest();
        const manifestHash = ethers.keccak256(manifest);

        const pluginInstallData = ethers.randomBytes(64);

        const installData = module.interface.encodeFunctionData('installPlugin', [mockPlugin.target, manifestHash, pluginInstallData, []]);

        await expect(safe.exec(safe.target, 0, installData)).to.be.revertedWithCustomError(module, "PluginInterfaceNotSupported").withArgs(mockPlugin.target);

      })


      it("Reverts if plugin does not support IPlugin interface", async () => {
        const { safe, module } = await setupTests();

        const mockPlugin = await ethers.deployContract("MockContract");
        const mockIERC165 = await ethers.getContractAt('@openzeppelin/contracts/utils/introspection/IERC165.sol:IERC165', mockPlugin.target);
        const callData = mockIERC165.interface.encodeFunctionData('supportsInterface', [IPLUGIN_INTERFACEID]);

        await mockPlugin.givenCalldataReturnBool(callData, false);

        const manifest = getPluginManifest();
        const manifestHash = ethers.keccak256(manifest);

        const pluginInstallData = ethers.randomBytes(64);

        const installData = module.interface.encodeFunctionData('installPlugin', [mockPlugin.target, manifestHash, pluginInstallData, []]);

        await expect(safe.exec(safe.target, 0, installData)).to.be.revertedWithCustomError(module, "PluginInterfaceNotSupported").withArgs(mockPlugin.target);

      })

      it("Reverts if manifest hash do not match", async () => {
        const { safe, module } = await setupTests();

        const mockPlugin = await ethers.deployContract("MockContract");
        await mockPlugin.givenMethodReturnBool("0x01ffc9a7", true);

        const manifest = getPluginManifest({});
        // pluginManifest() => 0xc7763130
        await mockPlugin.givenMethodReturn("0xc7763130", manifest);

        const pluginInstallData = ethers.randomBytes(64);
        const manifestHash = ethers.randomBytes(32);

        const installData = module.interface.encodeFunctionData('installPlugin', [mockPlugin.target, manifestHash, pluginInstallData, []]);

        await expect(safe.exec(safe.target, 0, installData)).to.be.revertedWithCustomError(module, "PluginManifestHashMismatch").withArgs(manifestHash);

      })
    })


    it("Uninstall plugin", async () => {
      const { safe, module } = await setupTests();

      const mockPlugin = await ethers.deployContract("MockContract");
      const manifest = getPluginManifest({});
      const manifestHash = ethers.keccak256(manifest);
      // pluginManifest() => 0xc7763130
      await mockPlugin.givenMethodReturn("0xc7763130", manifest);

      await mockPlugin.givenMethodReturnBool("0x01ffc9a7", true);
      const pluginInstallData = ethers.randomBytes(64);

      const installData = module.interface.encodeFunctionData('installPlugin', [mockPlugin.target, manifestHash, pluginInstallData, []]);
      await safe.exec(safe.target, 0, installData);
      expect(await module.installedPlugins(safe.target, mockPlugin.target)).to.be.equal(1n);

      const pluginUninstallData = ethers.randomBytes(64);

      const config = ethers.randomBytes(32);
      const uninstallData = module.interface.encodeFunctionData('uninstallPlugin', [mockPlugin.target, config, pluginUninstallData]);

      expect(await safe.exec(safe.target, 0, uninstallData)).to.emit(module, "PluginUninstalled").withArgs(mockPlugin.target, true);
      expect(await module.installedPlugins(safe.target, mockPlugin.target)).to.be.equal(0n);

    })
  })

});
