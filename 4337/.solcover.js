const fs = require("fs");
const path = require("path");

const testDir = path.join(__dirname, 'contracts', 'test');
const testContracts = fs.readdirSync(testDir)
    .filter((file) => file.endsWith('.sol'))
    .map((file) => path.join('test', file));

module.exports = {
    skipFiles: testContracts,
    mocha: {
        grep: '@skip-on-coverage', // Find everything with this tag
        invert: true, // Run the grep's inverse set.
    },
    providerOptions: {
        callGasLimit: '0x6691b7',
    },
}
