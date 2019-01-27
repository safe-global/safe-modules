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

An optional `rateToken` parameter gives owners the ability to define consistent payment amounts in tokens that have inconsistent values. For example, setting the `rateToken` to DAI, will ensure that the value being transfered on a monthly basis is always the same in USD.

Notes on datetime: The [ethereum-datetime](https://github.com/pipermerriam/ethereum-datetime) library is used to determine whether or not the transfer is valid. The contract itself has been copied from its original repository and placed inside the `contracts/external` folder. This has been done so that we may compile with `Solidity 0.5.0`. The contract can handle leap years and the `evm` accounts for leap seconds, so transfers will always execute as expected.

### Transfer Limit

The transfer limits module facilitates setting limits on withdrawal of funds from Safe. The user configures withdrawal limits for Ether and ERC-20 tokens, as well as a time frame, e.g. day or month, after which the expenditure gets reset to 0.

#### Authorization

Transfers can be executed by a subset of all owners of the Safe. The exact number of required confirmations (signatures) for a transfer is configured via the parameter `threshold`. In addition to owners of the Safe, the user can set a `delegate` address, whose signature will also be counted in when doing a transfer.

#### Token and global limits

Transfer limits can be set for Ether (in Wei) and ERC-20 tokens during setup (and updated afterwards). Additionally, a global Ether and/or Dai limit can be enabled, in which case, after checking against the limit of the particular token being transferred, the module also checks the total amount of Ether or Dai spent in the current time frame. Value of tokens in relation to Ether and Dai is fetched from [DutchX](http://dutchx.readthedocs.io/en/latest).

#### Time frames

The aforementioned token and global limits apply for a (ever-repeating) time frame. E.g. if time frame is one day, after each day the expenditure for every token (as well as global limits) is reset to 0. Time frame can be set in two modes: normal and rolling. A normal daily time frame starts at 00:00 of current day and ends at the same time next day. In the rolling mode, before each transfer the module will look back and if the duration of a whole time frame has passed since the last timestamp, it will reset expenditure to 0 and set the timestamp to current time.

#### Gas refund

The module supports refunding gas to submitted of the transaction, in a token of choice. This is useful for when users are not submitting transactions themselves, and want to incentivize a third party to submit transactions for them. Amount of gas to be repaid is specified by user when doing the transfer, and this refund amount will also be checked against transfer limits and will increase expenditure.

Security and Liability
----------------------
All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

License
-------
All smart contracts are released under LGPL v.3.

Contributors
------------
- Richard Meissner ([rmeissner](https://github.com/rmeissner))
