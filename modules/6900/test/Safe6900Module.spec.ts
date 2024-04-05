import { expect } from "chai";
import {deployments, ethers} from "hardhat";

describe("Safe6900Module", function () {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()

    const ModuleDeployment = await deployments.get('Safe6900Module')
  
    const module = await ethers.getContractAt('Safe6900Module', ModuleDeployment.address)
    const safe = await ethers.getContractAt('Safe', (await deployments.get('Safe')).address)

    return {
      safe,
      module
    }
  })

  it("Test Safe6900Module", async() => {

      const {module} = await setupTests();
      expect(module.target).to.be.not.null;
  })
});
