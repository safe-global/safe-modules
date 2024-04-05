"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const deploy = async ({ deployments, getNamedAccounts }) => {
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;
    await deploy('Safe6900Module', {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    });
};
deploy.dependencies = ['safe6900module'];
exports.default = deploy;
