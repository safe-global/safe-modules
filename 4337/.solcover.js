module.exports = {
    skipFiles: [],
    mocha: {
        grep: '@skip-on-coverage', // Find everything with this tag
        invert: true, // Run the grep's inverse set.
    },
    providerOptions: {
        callGasLimit: '0x6691b7',
    },
}
