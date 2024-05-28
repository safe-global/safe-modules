# Pimlico

## Safe Deployment with Pimlico ERC20 Paymaster

```
pnpm run pimlico:account:paymaster

> @safe-global/4337-gas-metering@1.0.0 pimlico:account
> tsx ./pimlico/pimlico.ts account

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x49Bcc15610B8bb5C35392E9bcCa19af516BeF408
Address Link: https://mumbai.polygonscan.com/address/0x49Bcc15610B8bb5C35392E9bcCa19af516BeF408

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Safe Wallet USDC Balance: 0

Transferring 1 USDC Token for paying the Paymaster from Sender to Safe.

Updated Safe Wallet USDC Balance: 1
UserOperation submitted. Hash: 0x81ba032e86c9169c9f295a1d435458ba7d7c0cab95a575b84081539e6266e461
UserOp Link: https://jiffyscan.xyz/userOpHash/0x81ba032e86c9169c9f295a1d435458ba7d7c0cab95a575b84081539e6266e461?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0x3c6284e4df1686d699d2bc4cca04a25ecc76d68a73665ca53d466e6bd6bedf28
Transaction Link: https://mumbai.polygonscan.com/tx/0x3c6284e4df1686d699d2bc4cca04a25ecc76d68a73665ca53d466e6bd6bedf28

Gas Used (Account or Paymaster): 504830
Gas Used (Transaction): 506573
```

## Safe Deployment + Native Transfer with Pimlico Paymaster (Own Sponsorship)

```
pnpm run pimlico:native-transfer

> @safe-global/4337-gas-metering@1.0.0 pimlico:native-transfer
> tsx ./pimlico/pimlico.ts native-transfer

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x32965E785bC35EaD9C837dd4e602E260B84f2594
Address Link: https://mumbai.polygonscan.com/address/0x32965E785bC35EaD9C837dd4e602E260B84f2594

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Safe Wallet USDC Balance: 0

Transferring 1 USDC Token for paying the Paymaster from Sender to Safe.

Updated Safe Wallet USDC Balance: 1
UserOperation submitted. Hash: 0x33550a7468bb4949c8cdc0b333cc9aa0e289f7e080e85274275644ef8d8786c9
UserOp Link: https://jiffyscan.xyz/userOpHash/0x33550a7468bb4949c8cdc0b333cc9aa0e289f7e080e85274275644ef8d8786c9?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0x8bc4e42b076d22e0fc3418eba40c65caab6e3a10c1fbb10cbeee4a7fbfa8b4b3
Transaction Link: https://mumbai.polygonscan.com/tx/0x8bc4e42b076d22e0fc3418eba40c65caab6e3a10c1fbb10cbeee4a7fbfa8b4b3

Gas Used (Account or Paymaster): 509312
Gas Used (Transaction): 511055
```

## Native Transfer with Pimlico Paymaster (Own Sponsorship)

```
pnpm run pimlico:native-transfer

> @safe-global/4337-gas-metering@1.0.0 pimlico:native-transfer
> tsx ./pimlico/pimlico.ts native-transfer

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x32965E785bC35EaD9C837dd4e602E260B84f2594
Address Link: https://mumbai.polygonscan.com/address/0x32965E785bC35EaD9C837dd4e602E260B84f2594

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Safe Wallet USDC Balance: 0

Transferring 1 USDC Token for paying the Paymaster from Sender to Safe.

Updated Safe Wallet USDC Balance: 1
UserOperation submitted. Hash: 0x1da0059783a7bd4d752bcc7b1a44c06f01236ba38687d502e9a69d7c84b1230e
UserOp Link: https://jiffyscan.xyz/userOpHash/0x1da0059783a7bd4d752bcc7b1a44c06f01236ba38687d502e9a69d7c84b1230e?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0x46cdfc14649087609f69411fc41f5feb4dc23a6ea9255928b932841858e5f186
Transaction Link: https://mumbai.polygonscan.com/tx/0x46cdfc14649087609f69411fc41f5feb4dc23a6ea9255928b932841858e5f186

Gas Used (Account or Paymaster): 197382
Gas Used (Transaction): 199262
```

## Safe Deployment + ERC20 Transaction with Pimlico Paymaster (Own Sponsorship)

```
pnpm run pimlico:erc20

> @safe-global/4337-gas-metering@1.0.0 pimlico:erc20
> tsx ./pimlico/pimlico.ts erc20

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x70E545d18b53413c47051a56b063AdE487a209Ff
Address Link: https://mumbai.polygonscan.com/address/0x70E545d18b53413c47051a56b063AdE487a209Ff

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.

Safe Wallet USDC Balance: 0

Transferring 1 USDC Token for paying the Paymaster from Sender to Safe.

Updated Safe Wallet USDC Balance: 1
UserOperation submitted. Hash: 0x4d175a2c4e151b7745e03ce9936e06fbc3115118d06e5b8bef5211add2151821
UserOp Link: https://jiffyscan.xyz/userOpHash/0x4d175a2c4e151b7745e03ce9936e06fbc3115118d06e5b8bef5211add2151821?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0xa5cf461800341c2e9934608ff55aeda26d1a3e7da4f5bc9f3cce3fd185409623
Transaction Link: https://mumbai.polygonscan.com/tx/0xa5cf461800341c2e9934608ff55aeda26d1a3e7da4f5bc9f3cce3fd185409623

Gas Used (Account or Paymaster): 517210
Gas Used (Transaction): 514156
```

## ERC20 Transaction with Pimlico Paymaster (Own Sponsorship)

```
pnpm run pimlico:erc20

> @safe-global/4337-gas-metering@1.0.0 pimlico:erc20
> tsx ./pimlico/pimlico.ts erc20

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x70E545d18b53413c47051a56b063AdE487a209Ff
Address Link: https://mumbai.polygonscan.com/address/0x70E545d18b53413c47051a56b063AdE487a209Ff

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.

Safe Wallet USDC Balance: 0

Transferring 1 USDC Token for paying the Paymaster from Sender to Safe.

Updated Safe Wallet USDC Balance: 1
UserOperation submitted. Hash: 0xd4475cf9151629cb44236b4da541996b103c4e89a075c2cb9375f533421da1e1
UserOp Link: https://jiffyscan.xyz/userOpHash/0xd4475cf9151629cb44236b4da541996b103c4e89a075c2cb9375f533421da1e1?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0xdc21ae13dc92eb48851fa62f57c74f3a0085acf81343d9aaaa14fcc3c6911f91
Transaction Link: https://mumbai.polygonscan.com/tx/0xdc21ae13dc92eb48851fa62f57c74f3a0085acf81343d9aaaa14fcc3c6911f91

Gas Used (Account or Paymaster): 205268
Gas Used (Transaction): 202387
```

## Safe Deployment + ERC721 Transaction with Pimlico Paymaster (Own Sponsorship)

```
pnpm run pimlico:erc721

> @safe-global/4337-gas-metering@1.0.0 pimlico:erc721
> tsx ./pimlico/pimlico.ts erc721

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x6306048538368FD9009102B10EdB6B38Fa6d48a7
Address Link: https://mumbai.polygonscan.com/address/0x6306048538368FD9009102B10EdB6B38Fa6d48a7

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Safe Wallet USDC Balance: 0

Transferring 1 USDC Token for paying the Paymaster from Sender to Safe.

Updated Safe Wallet USDC Balance: 1
UserOperation submitted. Hash: 0x24a391b1114c2ed44caea101d4a01011bb765c1f85e4d3f69fb16aae79ab2fac
UserOp Link: https://jiffyscan.xyz/userOpHash/0x24a391b1114c2ed44caea101d4a01011bb765c1f85e4d3f69fb16aae79ab2fac?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0xcd6c137474be4f002822498e032ad9b78b0505bd4db495ee65fc602ec1a7f006
Transaction Link: https://mumbai.polygonscan.com/tx/0xcd6c137474be4f002822498e032ad9b78b0505bd4db495ee65fc602ec1a7f006

Gas Used (Account or Paymaster): 541670
Gas Used (Transaction): 543411
```

## ERC721 Transaction with Pimlico Paymaster (Own Sponsorship)

```
pnpm run pimlico:erc721

> @safe-global/4337-gas-metering@1.0.0 pimlico:erc721
> tsx ./pimlico/pimlico.ts erc721

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x6306048538368FD9009102B10EdB6B38Fa6d48a7
Address Link: https://mumbai.polygonscan.com/address/0x6306048538368FD9009102B10EdB6B38Fa6d48a7

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Safe Wallet USDC Balance: 0

Transferring 1 USDC Token for paying the Paymaster from Sender to Safe.

Updated Safe Wallet USDC Balance: 1
UserOperation submitted. Hash: 0x05499bd6a9c3b6ecf4bd2ec5be00ae3f1e5597daca258b2a27c58b330a90cb28
UserOp Link: https://jiffyscan.xyz/userOpHash/0x05499bd6a9c3b6ecf4bd2ec5be00ae3f1e5597daca258b2a27c58b330a90cb28?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0x31732175d3f3b35c9c2a38e841bcd485085edf79e7f3c532ec7997c4993c0192
Transaction Link: https://mumbai.polygonscan.com/tx/0x31732175d3f3b35c9c2a38e841bcd485085edf79e7f3c532ec7997c4993c0192

Gas Used (Account or Paymaster): 229741
Gas Used (Transaction): 231619
```

## Safe Deployment with Pimlico Verifying Paymaster

```
pnpm run pimlico:account:verifying-paymaster

> @safe-global/safe-modules-example-4337-gas-metering@1.0.0 pimlico:account:verifying-paymaster
> tsx ./pimlico/pimlico.ts account verifyingPaymaster=true

Sponsorship Policy ID is not provided. This will only work for testnets, as pimlico are sponsoring the operations.
Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x28A293Cc8E2F8705A2896b76d55A701677faf0DC
Address Link: https://sepolia.etherscan.io/address/0x28A293Cc8E2F8705A2896b76d55A701677faf0DC

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.
UserOperation submitted. Hash: 0xa3ac4b8694bac34ffdbb5b3f12839b3fb18005081b926f67df32bb09a422c9ba
UserOp Link: https://jiffyscan.xyz/userOpHash/0xa3ac4b8694bac34ffdbb5b3f12839b3fb18005081b926f67df32bb09a422c9ba?network=sepolia

Querying for receipts...
Receipt found!
Transaction hash: 0x5a9119d67f76203ebfbdb641d7620d41242502cffa4a10b801a79a463ef60893
Transaction Link: https://sepolia.etherscan.io/tx/0x5a9119d67f76203ebfbdb641d7620d41242502cffa4a10b801a79a463ef60893

Gas Used (Account or Paymaster): 414071
Gas Used (Transaction): 396009
```

## Safe Deployment + Native Transfer with Pimlico Verifying Paymaster

```
pnpm run pimlico:native-transfer:verifying-paymaster

> @safe-global/safe-modules-example-4337-gas-metering@1.0.0 pimlico:native-transfer:verifying-paymaster
> tsx ./pimlico/pimlico.ts native-transfer verifyingPaymaster=true

Sponsorship Policy ID is not provided. This will only work for testnets, as pimlico are sponsoring the operations.
Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x805fa5CC045E7E51eba67F9A0b3737249eB06D75
Address Link: https://sepolia.etherscan.io/address/0x805fa5CC045E7E51eba67F9A0b3737249eB06D75

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Transferring 0.000001 ETH to Safe for native transfer.

Transferred required ETH for the native transfer.

Appropriate calldata created.
UserOperation submitted. Hash: 0x2131d9b4c75da72f6c00dc3db49629e06d2baa110b4a94715cedf0cdd5c90f87
UserOp Link: https://jiffyscan.xyz/userOpHash/0x2131d9b4c75da72f6c00dc3db49629e06d2baa110b4a94715cedf0cdd5c90f87?network=sepolia

Querying for receipts...
Receipt found!
Transaction hash: 0x9c92c03c6f6abee15c8b7857d1dfa0d3aec517b7d116ae6f8b1034e192667a75
Transaction Link: https://sepolia.etherscan.io/tx/0x9c92c03c6f6abee15c8b7857d1dfa0d3aec517b7d116ae6f8b1034e192667a75

Gas Used (Account or Paymaster): 421350
Gas Used (Transaction): 403404
```

## Native Transfer with Pimlico Verifying Paymaster

```
pnpm run pimlico:native-transfer:verifying-paymaster

> @safe-global/safe-modules-example-4337-gas-metering@1.0.0 pimlico:native-transfer:verifying-paymaster
> tsx ./pimlico/pimlico.ts native-transfer verifyingPaymaster=true

Sponsorship Policy ID is not provided. This will only work for testnets, as pimlico are sponsoring the operations.
Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x805fa5CC045E7E51eba67F9A0b3737249eB06D75
Address Link: https://sepolia.etherscan.io/address/0x805fa5CC045E7E51eba67F9A0b3737249eB06D75

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Transferring 0.000001 ETH to Safe for native transfer.

Transferred required ETH for the native transfer.

Appropriate calldata created.
UserOperation submitted. Hash: 0x74445f733932717618715fe3d202521653246fcdf4a5f91d9504f4e54189c327
UserOp Link: https://jiffyscan.xyz/userOpHash/0x74445f733932717618715fe3d202521653246fcdf4a5f91d9504f4e54189c327?network=sepolia

Querying for receipts...
Receipt found!
Transaction hash: 0xb01f64d8db284a6f05fa7083a242bb238f44a70e49a55d6046e99c2f9029dc3f
Transaction Link: https://sepolia.etherscan.io/tx/0xb01f64d8db284a6f05fa7083a242bb238f44a70e49a55d6046e99c2f9029dc3f

Gas Used (Account or Paymaster): 137723
Gas Used (Transaction): 120355
```

## Safe Deployment + ERC20 Transaction with Pimlico Verifying Paymaster

```
pnpm run pimlico:erc20:verifying-paymaster

> @safe-global/safe-modules-example-4337-gas-metering@1.0.0 pimlico:erc20:verifying-paymaster
> tsx ./pimlico/pimlico.ts erc20 verifyingPaymaster=true

Sponsorship Policy ID is not provided. This will only work for testnets, as pimlico are sponsoring the operations.
Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xaaD0B5bC7a1981aE9712F13db47Fa420283E892E
Address Link: https://sepolia.etherscan.io/address/0xaaD0B5bC7a1981aE9712F13db47Fa420283E892E

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.
UserOperation submitted. Hash: 0xd9689b262cfcbc30993cec3c4c0a4e192c971ff2886ad7094065e4b9cdf016cb
UserOp Link: https://jiffyscan.xyz/userOpHash/0xd9689b262cfcbc30993cec3c4c0a4e192c971ff2886ad7094065e4b9cdf016cb?network=sepolia

Querying for receipts...
Receipt found!
Transaction hash: 0x2c23f209eb25208bb977fb81992dbc072201ab8d4d7dd2a2c527558c6d22a6b6
Transaction Link: https://sepolia.etherscan.io/tx/0x2c23f209eb25208bb977fb81992dbc072201ab8d4d7dd2a2c527558c6d22a6b6

Gas Used (Account or Paymaster): 446477
Gas Used (Transaction): 423670
```

## ERC20 Transaction with Pimlico Verifying Paymaster

```
pnpm run pimlico:erc20:verifying-paymaster

> @safe-global/safe-modules-example-4337-gas-metering@1.0.0 pimlico:erc20:verifying-paymaster
> tsx ./pimlico/pimlico.ts erc20 verifyingPaymaster=true

Sponsorship Policy ID is not provided. This will only work for testnets, as pimlico are sponsoring the operations.
Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xaaD0B5bC7a1981aE9712F13db47Fa420283E892E
Address Link: https://sepolia.etherscan.io/address/0xaaD0B5bC7a1981aE9712F13db47Fa420283E892E

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.
UserOperation submitted. Hash: 0x78ef12748b94bdc1c39e646196ae9dbfc02404924f0b6839d2f9de74262f3238
UserOp Link: https://jiffyscan.xyz/userOpHash/0x78ef12748b94bdc1c39e646196ae9dbfc02404924f0b6839d2f9de74262f3238?network=sepolia

Querying for receipts...
Receipt found!
Transaction hash: 0x556a93d3481866744217adacc930c05544293053068ce3bba81d6af81b18d12e
Transaction Link: https://sepolia.etherscan.io/tx/0x556a93d3481866744217adacc930c05544293053068ce3bba81d6af81b18d12e

Gas Used (Account or Paymaster): 145721
Gas Used (Transaction): 123494
```

## Safe Deployment + ERC721 Transaction with Pimlico Verifying Paymaster

```
pnpm run pimlico:erc721:verifying-paymaster

> @safe-global/safe-modules-example-4337-gas-metering@1.0.0 pimlico:erc721:verifying-paymaster
> tsx ./pimlico/pimlico.ts erc721 verifyingPaymaster=true

Sponsorship Policy ID is not provided. This will only work for testnets, as pimlico are sponsoring the operations.
Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xaFdEf274B5f68fa12f7d5D9dF99De16a974ec697
Address Link: https://sepolia.etherscan.io/address/0xaFdEf274B5f68fa12f7d5D9dF99De16a974ec697

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.
UserOperation submitted. Hash: 0xbe821b819192a32ccd468226abcc2775e9bbb212cbde104d2a725aa38d1879bc
UserOp Link: https://jiffyscan.xyz/userOpHash/0xbe821b819192a32ccd468226abcc2775e9bbb212cbde104d2a725aa38d1879bc?network=sepolia

Querying for receipts...
Receipt found!
Transaction hash: 0x45ee84ab39fed43d2d2399aaa3e9aa9ebe2a65691d80d4e169b0c6efd21ec3cb
Transaction Link: https://sepolia.etherscan.io/tx/0x45ee84ab39fed43d2d2399aaa3e9aa9ebe2a65691d80d4e169b0c6efd21ec3cb

Gas Used (Account or Paymaster): 470905
Gas Used (Transaction): 452929
```

## ERC721 Transaction with Pimlico Verifying Paymaster

```
pnpm run pimlico:erc721:verifying-paymaster

> @safe-global/safe-modules-example-4337-gas-metering@1.0.0 pimlico:erc721:verifying-paymaster
> tsx ./pimlico/pimlico.ts erc721 verifyingPaymaster=true

Sponsorship Policy ID is not provided. This will only work for testnets, as pimlico are sponsoring the operations.
Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xaFdEf274B5f68fa12f7d5D9dF99De16a974ec697
Address Link: https://sepolia.etherscan.io/address/0xaFdEf274B5f68fa12f7d5D9dF99De16a974ec697

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Appropriate calldata created.
UserOperation submitted. Hash: 0xd75a2f1f5572866f1f80adae7d27b7d15764eba9bc64c7819b0ea474c548cd24
UserOp Link: https://jiffyscan.xyz/userOpHash/0xd75a2f1f5572866f1f80adae7d27b7d15764eba9bc64c7819b0ea474c548cd24?network=sepolia

Querying for receipts...
Receipt found!
Transaction hash: 0x22b94bd700109d5d46b5f1da1414e5c582cc1bedc9418371d24e320bfc0d44eb
Transaction Link: https://sepolia.etherscan.io/tx/0x22b94bd700109d5d46b5f1da1414e5c582cc1bedc9418371d24e320bfc0d44eb

Gas Used (Account or Paymaster): 170150
Gas Used (Transaction): 152766
```
