import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    if (hre.network.name == 'hardhat') {
        await deploy("SafeProxyFactory", {
            from: deployer,
            args: [],
            log: true,
            deterministicDeployment: true,
        });

        await deploy("SafeL2", {
            from: deployer,
            args: [],
            log: true,
            deterministicDeployment: true, 
        });
    }

    await deploy('HariWillibaldToken', {
        from: deployer,
        args: [deployer],
        log: true,
        deterministicDeployment: true,
    })
};

deploy.tags = ["factory", "l2-suite", "main-suite"];
export default deploy;
