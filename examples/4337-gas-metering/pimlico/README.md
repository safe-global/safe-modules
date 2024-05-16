# Pimlico

## Safe Deployment With Pimlico (No Paymaster)

```
npm run pimlico:account

> @safe-global/safe-modules-example-4337-gas-metering@1.0.0 pimlico:account
> tsx ./pimlico/pimlico.ts account

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x967c56B4Bc5628Fd275b3d466Cc075BeB33Fc7Fc
Address Link: https://sepolia.etherscan.io/address/0x967c56B4Bc5628Fd275b3d466Cc075BeB33Fc7Fc

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Sender ETH Balance: 0.0

Required Prefund: 0.065434566830611091
UserOperation submitted. Hash: 0x4d02a5c5b7f78843e392a0ba7ab3abc23e34ebcf9dbb89bcb48112805806d15a
UserOp Link: https://jiffyscan.xyz/userOpHash/0x4d02a5c5b7f78843e392a0ba7ab3abc23e34ebcf9dbb89bcb48112805806d15a?network=sepolia

Querying for receipts...
Receipt found!
Transaction hash: 0x09c9cad7d6a4fe405531e132f3e53e02599a7a379f33fc3378d75a80ae80ef7f
Transaction Link: https://sepolia.etherscan.io/tx/0x09c9cad7d6a4fe405531e132f3e53e02599a7a379f33fc3378d75a80ae80ef7f

Gas Used (Account or Paymaster): 433672
Gas Used (Transaction): 419491
```


## Safe Deployment with Pimlico Paymaster (Own Sponsorship)

```
npm run pimlico:account:paymaster

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
npm run pimlico:native-transfer

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
npm run pimlico:native-transfer

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
npm run pimlico:erc20

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
npm run pimlico:erc20

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
npm run pimlico:erc721

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
npm run pimlico:erc721

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

## Safe Deployment with Pimlico Paymaster (Gas Policy)

```
npm run pimlico:account:paymaster

> @safe-global/4337-gas-metering@1.0.0 pimlico:account:paymaster
> tsx ./pimlico/pimlico.ts account paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x8ac55DeB4a707BDD62f63D98570B82736b3FBC64
Address Link: https://mumbai.polygonscan.com/address/0x8ac55DeB4a707BDD62f63D98570B82736b3FBC64

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.
UserOperation submitted. Hash: 0xbf6edac0683e35c855467cb9822eb6d151d7826ee15404ddb618d906800092dc
UserOp Link: https://jiffyscan.xyz/userOpHash/0xbf6edac0683e35c855467cb9822eb6d151d7826ee15404ddb618d906800092dc?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0xd51d026ecfa6dbafa8aac8a138badc6e3b397683117878e360bae9051a3b733a
Transaction Link: https://mumbai.polygonscan.com/tx/0xd51d026ecfa6dbafa8aac8a138badc6e3b397683117878e360bae9051a3b733a

Gas Used (Account or Paymaster): 446245
Gas Used (Transaction): 448172
```

## Safe Deployment + Native Transfer with Pimlico Paymaster (Gas Policy)

```
npm run pimlico:native-transfer:paymaster

> @safe-global/4337-gas-metering@1.0.0 pimlico:native-transfer:paymaster
> tsx ./pimlico/pimlico.ts native-transfer paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x8fE158E24Aa2330F002aabB967815a817FE4F478
Address Link: https://mumbai.polygonscan.com/address/0x8fE158E24Aa2330F002aabB967815a817FE4F478

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.
UserOperation submitted. Hash: 0x7d2ca6fba592799c4c9aa5e38ea24bd31d4516a53030b09b263341912bf819bc
UserOp Link: https://jiffyscan.xyz/userOpHash/0x7d2ca6fba592799c4c9aa5e38ea24bd31d4516a53030b09b263341912bf819bc?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0xdd966b95b6625be33ae37f6c5bb1ad33798afbbd899089acad1180005d0637c4
Transaction Link: https://mumbai.polygonscan.com/tx/0xdd966b95b6625be33ae37f6c5bb1ad33798afbbd899089acad1180005d0637c4

Gas Used (Account or Paymaster): 453652
Gas Used (Transaction): 455615
```

## Native Transfer with Pimlico Paymaster (Gas Policy)

```
npm run pimlico:native-transfer:paymaster

> @safe-global/4337-gas-metering@1.0.0 pimlico:native-transfer:paymaster
> tsx ./pimlico/pimlico.ts native-transfer paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x8fE158E24Aa2330F002aabB967815a817FE4F478
Address Link: https://mumbai.polygonscan.com/address/0x8fE158E24Aa2330F002aabB967815a817FE4F478

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Appropriate calldata created.
UserOperation submitted. Hash: 0x38fd87397a93359b50265f3bf388b0a03a5f1845b977a0a7b1fb6ac053241eb9
UserOp Link: https://jiffyscan.xyz/userOpHash/0x38fd87397a93359b50265f3bf388b0a03a5f1845b977a0a7b1fb6ac053241eb9?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0xca2e41e24c6206011fe0d932f27a2786c7d9486c93f63d96c131c5007e2b275e
Transaction Link: https://mumbai.polygonscan.com/tx/0xca2e41e24c6206011fe0d932f27a2786c7d9486c93f63d96c131c5007e2b275e

Gas Used (Account or Paymaster): 120998
Gas Used (Transaction): 123064
```

## Safe Deployment + ERC20 Transaction with Pimlico Paymaster (Gas Policy)

```
npm run pimlico:erc20:paymaster

> @safe-global/4337-gas-metering@1.0.0 pimlico:erc20:paymaster
> tsx ./pimlico/pimlico.ts erc20 paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x8aaADBe50a15e1aFfe7D4363D4e00540E8e0db7D
Address Link: https://mumbai.polygonscan.com/address/0x8aaADBe50a15e1aFfe7D4363D4e00540E8e0db7D

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.
UserOperation submitted. Hash: 0xaa85e8c6f94695fb829541e55eda8b5b5f23a8cca4541f4a53d62b1280861736
UserOp Link: https://jiffyscan.xyz/userOpHash/0xaa85e8c6f94695fb829541e55eda8b5b5f23a8cca4541f4a53d62b1280861736?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0xbd4c79d876ae928bbc721501029b01dbc5fc94d91d6299f548f19289f7c1c271
Transaction Link: https://mumbai.polygonscan.com/tx/0xbd4c79d876ae928bbc721501029b01dbc5fc94d91d6299f548f19289f7c1c271

Gas Used (Account or Paymaster): 461859
Gas Used (Transaction): 459014
```

## ERC20 Transaction with Pimlico Paymaster (Gas Policy)

```
npm run pimlico:erc20:paymaster

> @safe-global/4337-gas-metering@1.0.0 pimlico:erc20:paymaster
> tsx ./pimlico/pimlico.ts erc20 paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x8aaADBe50a15e1aFfe7D4363D4e00540E8e0db7D
Address Link: https://mumbai.polygonscan.com/address/0x8aaADBe50a15e1aFfe7D4363D4e00540E8e0db7D

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.
UserOperation submitted. Hash: 0xbc1283f136edac0ea47d140c2ab11568a33584021cd0530eec3a2a5515136822
UserOp Link: https://jiffyscan.xyz/userOpHash/0xbc1283f136edac0ea47d140c2ab11568a33584021cd0530eec3a2a5515136822?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0xd2b130bc2f26cfe43041f7102601425674e2cd22a6b74672b907b28e70686496
Transaction Link: https://mumbai.polygonscan.com/tx/0xd2b130bc2f26cfe43041f7102601425674e2cd22a6b74672b907b28e70686496

Gas Used (Account or Paymaster): 129190
Gas Used (Transaction): 126461
```

## Safe Deployment + ERC721 Transaction with Pimlico Paymaster (Gas Policy)

```
npm run pimlico:erc721:paymaster

> @safe-global/4337-gas-metering@1.0.0 pimlico:erc721:paymaster
> tsx ./pimlico/pimlico.ts erc721 paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x07a49F28A360B7799AeEBC9907bE605daFc13a30
Address Link: https://mumbai.polygonscan.com/address/0x07a49F28A360B7799AeEBC9907bE605daFc13a30

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.
UserOperation submitted. Hash: 0x9b917c637eed529c8ae13eeb00ed8fdf3aac711dea7efdac7c048ba16bd9c8e3
UserOp Link: https://jiffyscan.xyz/userOpHash/0x9b917c637eed529c8ae13eeb00ed8fdf3aac711dea7efdac7c048ba16bd9c8e3?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0x454a3a5a39432f7b01a70fcddfef948d20c70d2d719aea30d402d693447fa535
Transaction Link: https://mumbai.polygonscan.com/tx/0x454a3a5a39432f7b01a70fcddfef948d20c70d2d719aea30d402d693447fa535

Gas Used (Account or Paymaster): 486237
Gas Used (Transaction): 488186
```

## ERC721 Transaction with Pimlico Paymaster (Gas Policy)

```
npm run pimlico:erc721:paymaster

> @safe-global/4337-gas-metering@1.0.0 pimlico:erc721:paymaster
> tsx ./pimlico/pimlico.ts erc721 paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x07a49F28A360B7799AeEBC9907bE605daFc13a30
Address Link: https://mumbai.polygonscan.com/address/0x07a49F28A360B7799AeEBC9907bE605daFc13a30

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Appropriate calldata created.
UserOperation submitted. Hash: 0x8a82cfc2396e1031f09e8f9725e276ded8e2a741a70264d6b23aaafc314e7105
UserOp Link: https://jiffyscan.xyz/userOpHash/0x8a82cfc2396e1031f09e8f9725e276ded8e2a741a70264d6b23aaafc314e7105?network=mumbai

Querying for receipts...
Receipt found!
Transaction hash: 0xa148a4938de9883b2fbcd512e3c7161e78ca695843b6e535fdb5054b88872652
Transaction Link: https://mumbai.polygonscan.com/tx/0xa148a4938de9883b2fbcd512e3c7161e78ca695843b6e535fdb5054b88872652

Gas Used (Account or Paymaster): 153569
Gas Used (Transaction): 155645
```
