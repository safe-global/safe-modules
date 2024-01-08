Recurring Transfer Module
=========================

The Recurring Transfers module gives a Safe owner the ability to define transfers of ETH/ERC20 tokens that can be executed once a month within a given time frame. Any owner has the ability to execute this transfer along with an optional `delegate`. The transfer window can only be defined with whole hours (e.g. 2pm, 3am,..) and must take place on a single day. So a transfer starting on one day of the month and ending on another is not possible. To ensure that the transaction can be executed every month, the transaction day must be before the 29th.

An optional `rateToken` parameter gives owners the ability to define consistent payment amounts in tokens that have inconsistent values. For example, setting the `rateToken` to DAI, will ensure that the value being transfered on a monthly basis is always the same in USD.

Notes on datetime: The [ethereum-datetime](https://github.com/pipermerriam/ethereum-datetime) library is used to determine whether or not the transfer is valid. The contract itself has been copied from its original repository and placed inside the `contracts/external` folder. This has been done so that we may compile with `Solidity 0.5.0`. The contract can handle leap years and the `evm` accounts for leap seconds, so transfers will always execute as expected.

Install
-------
### Install requirements with yarn:

```bash
yarn
```

### Compile Contracts

```bash
yarn truffle compile
```

### Run all tests (requires Node version >=7 for `async/await`):

```bash
yarn test
```

### Linter and Test Coverage

```bash
yarn run lint
yarn run coverage
```

Security and Liability
----------------------
All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

License
-------
All smart contracts are released under LGPL v.3.
