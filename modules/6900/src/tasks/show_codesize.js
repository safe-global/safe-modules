"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("hardhat/config");
const solc_1 = require("../utils/solc");
(0, config_1.task)('codesize', 'Displays the codesize of the contracts')
    .addParam('skipcompile', 'should not compile before printing size', false, config_1.types.boolean, true)
    .addParam('contractname', 'name of the contract', undefined, config_1.types.string, true)
    .setAction(async (taskArgs, hre) => {
    if (!taskArgs.skipcompile) {
        await hre.run('compile');
    }
    const contracts = await hre.artifacts.getAllFullyQualifiedNames();
    for (const contract of contracts) {
        const artifact = await hre.artifacts.readArtifact(contract);
        if (taskArgs.contractname && taskArgs.contractname !== artifact.contractName)
            continue;
        console.log(artifact.contractName, hre.ethers.dataLength(artifact.deployedBytecode), 'bytes (limit is 24576)');
    }
});
(0, config_1.task)('yulcode', 'Outputs yul code for contracts')
    .addParam('contractname', 'name of the contract', undefined, config_1.types.string, true)
    .setAction(async (taskArgs, hre) => {
    const contracts = await hre.artifacts.getAllFullyQualifiedNames();
    for (const contract of contracts) {
        if (taskArgs.contractname && !contract.endsWith(taskArgs.contractname))
            continue;
        const buildInfo = await hre.artifacts.getBuildInfo(contract);
        if (!buildInfo)
            return;
        console.log({ buildInfo });
        buildInfo.input.settings.outputSelection['*']['*'].push('ir', 'evm.assembly');
        const solcjs = await (0, solc_1.loadSolc)(buildInfo.solcLongVersion);
        const compiled = solcjs.compile(JSON.stringify(buildInfo.input));
        const output = JSON.parse(compiled);
        console.log(output.contracts[contract.split(':')[0]]);
        console.log(output.errors);
    }
});
