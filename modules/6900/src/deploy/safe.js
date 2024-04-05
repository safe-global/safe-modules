"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const deploy = async ({ deployments, getNamedAccounts }) => {
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;
    await deploy('Safe', {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    });
};
deploy.dependencies = ['safe'];
exports.default = deploy;
