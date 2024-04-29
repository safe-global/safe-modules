import { expect } from "chai";
import {deployments, ethers} from "hardhat";
import { getEntryPoint } from "./utils/setup";

describe("Safe6900Module", function () {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const ModuleDeployment = await deployments.get('Safe6900Module')
  
    const module = await ethers.getContractAt('Safe6900Module', ModuleDeployment.address)
    const safe = await ethers.getContractAt('Safe', (await deployments.get('Safe')).address)
    const entryPoint = await getEntryPoint()

    return {
      safe,
      module,
      entryPoint
    }
  })

  describe("Plugin management",()=>{
    it("Install plugin", async() => {
      const {module} = await setupTests();
      expect(module.target).to.be.not.null;
    })

    it("Uninstall plugin", async() => {
      const {module} = await setupTests();
      expect(module.target).to.be.not.null;
    })
  })

});
