# Bequest module

This contract allows to bequest all funds on the wallet to be withdrawn after a given time.
Moreover, after the given time the heir can execute any transaction on the inherited wallet.

## Setting up allowances

The contract is designed as a single point registry. This way not every Safe needs to deploy their own module and it is possible that this module is shared between different Safes.

To set an allowance for a Safe it is first required that the Safe adds a **delegate**. For this a Safe transaction needs to be executed that calls `addDelegate`. This method will add the specified **delegate** for `msg.sender`, which is the Safe in case of a Safe transaction. The `addDelegate` method can be called multiple times with the same address for a **delegate** without failure.

TODO

## Running tests

TODO: Add tests.

```bash
yarn
yarn test
```

## Compiling contracts
```bash
yarn
yarn compile
```