"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe("Safe6900Module", function () {
    const setupTests = hardhat_1.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const ModuleDeployment = await deployments.get('Safe6900Module');
        const module = await hardhat_1.ethers.getContractAt('Safe6900Module', ModuleDeployment.address);
        const safe = await hardhat_1.ethers.getContractAt('Safe', (await deployments.get('Safe')).address);
        return {
            safe,
            module
        };
    });
    it("Test Safe6900Module", async () => {
        const { module } = await setupTests();
        (0, chai_1.expect)(module.target).to.be.not.null;
    });
});
