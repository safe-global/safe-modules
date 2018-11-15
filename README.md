Gnosis Safe Modules
===================

This repository contains a collection of modules that can be used with the [Gnosis Safe contracts](https://github.com/gnosis/safe-contracts)

Install
-------
### Install requirements with npm:

```bash
npm install
```

### Compile Contracts

```bash
truffle compile
```

### Run all tests (requires Node version >=7 for `async/await`):

```bash
npm test
```

### Linter and Test Coverage

```bash
npm run lint
npm run coverage
```

Modules
-------

### Recurring Transfers
The Recurring Transfers module gives a Safe owner the ability to define transfers of ETH/ERC20 tokens that can be executed once a month within a given time frame. Any owner has the ability to execute this transfer along with an optional `delegate`. The transfer window can only be defined with whole hours (e.g. 2pm, 3am,..) and must take place on a single day. So a transfer starting on one day of the month and ending on another is not possible. To ensure that the transaction can be executed every month, the transaction day must be before the 29th.

An optional `rate` parameter gives owners the ability to define consistent payment amounts in tokens that have inconsistent values. For example, setting the `rate` to DAI, will ensure that the value being transfered on a monthly basis is always the same in USD.

Notes on date time: The [ethereum-datetime](https://github.com/pipermerriam/ethereum-datetime) library is used to determine whether or not the transfer is valid. It **does not** currently support leap seconds and can be found verified on the Mainnet [here](https://etherscan.io/address/0x1a6184cd4c5bea62b0116de7962ee7315b7bcbce#code).

Security and Liability
----------------------
All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

License
-------
All smart contracts are released under LGPL v.3.

Contributors
------------
- Richard Meissner ([rmeissner](https://github.com/rmeissner))
