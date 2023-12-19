# Alchemy

## Safe Deployment with Alchemy Paymaster (Own Sponsorship)

```
npm run alchemy:account

> @safe-global/4337-gas-metering@1.0.0 alchemy:account
> tsx ./alchemy/alchemy.ts account

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xbf2AE89D8565bc948772097082f2e000FF72CBAB
Address Link: https://sepolia.etherscan.io/address/0xbf2AE89D8565bc948772097082f2e000FF72CBAB

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Fee Data from Alchemy.

Received Gas Data from Alchemy.

Transferring 0.02 ETH to Safe for transaction.

Transferred required ETH for the transaction.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0xa27fdf3167c094f36a312c14f9c9f46dc6ef205aaece8fb395132d5204c2e85f
UserOp Link: https://jiffyscan.xyz/userOpHash/0xa27fdf3167c094f36a312c14f9c9f46dc6ef205aaece8fb395132d5204c2e85f?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x03c507f5dc14c6b6af04c5ad722f0650d86925837d9889e4972cb087e34d7b88

Gas Used (Account or Paymaster): 417476
Gas Used (Transaction): 417074
```

## Safe Deployment + Native Transfer with Alchemy Paymaster (Own Sponsorship)

```
npm run alchemy:native-transfer

> @safe-global/4337-gas-metering@1.0.0 alchemy:native-transfer
> tsx ./alchemy/alchemy.ts native-transfer

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x0cc883d620a0E313971bd713D1556Ec4dc6821f1
Address Link: https://sepolia.etherscan.io/address/0x0cc883d620a0E313971bd713D1556Ec4dc6821f1

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Fee Data from Alchemy.

Received Gas Data from Alchemy.

Transferring 0.02 ETH to Safe for transaction.

Transferred required ETH for the transaction.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0x19b5f1f34fd95466e5865cf10647baf68eed16e815a15a3665c2301c19a07337
UserOp Link: https://jiffyscan.xyz/userOpHash/0x19b5f1f34fd95466e5865cf10647baf68eed16e815a15a3665c2301c19a07337?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x0263331d8d4568c08d4a700385c08062ee0342fe6f65b2c7eb1a194ddec23ec2

Gas Used (Account or Paymaster): 424919
Gas Used (Transaction): 424505
```

## Native Transfer with Alchemy Paymaster (Own Sponsorship)

```
npm run alchemy:native-transfer

> @safe-global/4337-gas-metering@1.0.0 alchemy:native-transfer
> tsx ./alchemy/alchemy.ts native-transfer

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x0cc883d620a0E313971bd713D1556Ec4dc6821f1
Address Link: https://sepolia.etherscan.io/address/0x0cc883d620a0E313971bd713D1556Ec4dc6821f1

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Fee Data from Alchemy.

Received Gas Data from Alchemy.

Transferring 0.01127255359589216 ETH to Safe for transaction.

Transferred required ETH for the transaction.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0xd5b3d3a2f80eba8abd56309a30f2f4eb61c7de6ca3f0c00cc446cb2b570d1c23
UserOp Link: https://jiffyscan.xyz/userOpHash/0xd5b3d3a2f80eba8abd56309a30f2f4eb61c7de6ca3f0c00cc446cb2b570d1c23?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0xf4e38d9f3535dcb9519ca3527734a5ea611a0d1bafb632051736537853eb502b

Gas Used (Account or Paymaster): 107379
Gas Used (Transaction): 107057
```

## Safe Deployment + ERC20 Transaction with Alchemy Paymaster (Own Sponsorship)

```
npm run alchemy:erc20          

> @safe-global/4337-gas-metering@1.0.0 alchemy:erc20
> tsx ./alchemy/alchemy.ts erc20

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x395E28c040ADe3470B60eE4024a37FeA85ec3Df1
Address Link: https://sepolia.etherscan.io/address/0x395E28c040ADe3470B60eE4024a37FeA85ec3Df1

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Fee Data from Alchemy.

Received Gas Data from Alchemy.

Transferring 0.02 ETH to Safe for transaction.

Transferred required ETH for the transaction.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0x7a588948e8fd155e40ad848a5bb08cb8f903af59639f645655748376150cb082
UserOp Link: https://jiffyscan.xyz/userOpHash/0x7a588948e8fd155e40ad848a5bb08cb8f903af59639f645655748376150cb082?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x794b02531f14b6c432c0dcf08d1cb76a8693dd75b35c5dde0d4547754d208143

Gas Used (Account or Paymaster): 432797
Gas Used (Transaction): 427599
```

## ERC20 Transaction with Alchemy Paymaster (Own Sponsorship)

```
npm run alchemy:erc20

> @safe-global/4337-gas-metering@1.0.0 alchemy:erc20
> tsx ./alchemy/alchemy.ts erc20

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x395E28c040ADe3470B60eE4024a37FeA85ec3Df1
Address Link: https://sepolia.etherscan.io/address/0x395E28c040ADe3470B60eE4024a37FeA85ec3Df1

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Fee Data from Alchemy.

Received Gas Data from Alchemy.

Transferring 0.014251001650899964 ETH to Safe for transaction.

Transferred required ETH for the transaction.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0xe8c6de35003a3b7a3164b5bad8ec9008a9f034459084cea05d45bcfa8b00a8b6
UserOp Link: https://jiffyscan.xyz/userOpHash/0xe8c6de35003a3b7a3164b5bad8ec9008a9f034459084cea05d45bcfa8b00a8b6?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0xb56985ee07b1e7931aedc387698620d890c99992c4c688b8b3a150f355089e5d

Gas Used (Account or Paymaster): 115268
Gas Used (Transaction): 110174
```

## Safe Deployment + ERC721 Transaction with Alchemy Paymaster (Own Sponsorship)

```
npm run alchemy:erc721

> @safe-global/4337-gas-metering@1.0.0 alchemy:erc721
> tsx ./alchemy/alchemy.ts erc721

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x998CFAdDe39b44c7f94eD4694FD134F764956eC1
Address Link: https://sepolia.etherscan.io/address/0x998CFAdDe39b44c7f94eD4694FD134F764956eC1

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Fee Data from Alchemy.

Received Gas Data from Alchemy.

Transferring 0.02 ETH to Safe for transaction.

Transferred required ETH for the transaction.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0x516e6526c5617165d5570999494b428f7be3e864dc28b7094829be3e42f87714
UserOp Link: https://jiffyscan.xyz/userOpHash/0x516e6526c5617165d5570999494b428f7be3e864dc28b7094829be3e42f87714?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x2d2a0c8215821f0aa9cf8f88175aa8256cdca1a2928f2aa667916e5127f5dcb6

Gas Used (Account or Paymaster): 457274
Gas Used (Transaction): 456870
```

## ERC721 Transaction with Alchemy Paymaster (Own Sponsorship)

```
npm run alchemy:erc721

> @safe-global/4337-gas-metering@1.0.0 alchemy:erc721
> tsx ./alchemy/alchemy.ts erc721

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x998CFAdDe39b44c7f94eD4694FD134F764956eC1
Address Link: https://sepolia.etherscan.io/address/0x998CFAdDe39b44c7f94eD4694FD134F764956eC1

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Fee Data from Alchemy.

Received Gas Data from Alchemy.

Transferring 0.013259139013776724 ETH to Safe for transaction.

Transferred required ETH for the transaction.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0x236f50d14082d4d6df8b9b3a68d837579c80253d7aebd7ed9f224a42f9914e4f
UserOp Link: https://jiffyscan.xyz/userOpHash/0x236f50d14082d4d6df8b9b3a68d837579c80253d7aebd7ed9f224a42f9914e4f?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x178d2c16a261dcb49e810bf39ce35cf96cbab8c7d3235709c7164ba6193c716e

Gas Used (Account or Paymaster): 139744
Gas Used (Transaction): 139420
```

## Safe Deployment with Alchemy Paymaster (Gas Policy)

```
npm run alchemy:account:paymaster 

> @safe-global/4337-gas-metering@1.0.0 alchemy:account:paymaster
> tsx ./alchemy/alchemy.ts account paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xb00f9dEda8C1822Ab7d5b721518054F3C4437ed3
Address Link: https://sepolia.etherscan.io/address/0xb00f9dEda8C1822Ab7d5b721518054F3C4437ed3

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Paymaster Data from Alchemy.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0x53f77a84f9f1662bc729e1afe39038ba1b7d6a8118bf4f91d7889cbcf7fb04ca
UserOp Link: https://jiffyscan.xyz/userOpHash/0x53f77a84f9f1662bc729e1afe39038ba1b7d6a8118bf4f91d7889cbcf7fb04ca?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0xcbb2c3c49b9d72d9ecf692308d69a8ad797ab5b1c6603f4fad989f966d692af1

Gas Used (Account or Paymaster): 411685
Gas Used (Transaction): 411372
```

## Safe Deployment + Native Transfer with Alchemy Paymaster (Gas Policy)

```
npm run alchemy:native-transfer:paymaster

> @safe-global/4337-gas-metering@1.0.0 alchemy:native-transfer:paymaster
> tsx ./alchemy/alchemy.ts native-transfer paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xA6317eA7527e846cf0d47F66f1A29f20e9Fe27cB
Address Link: https://sepolia.etherscan.io/address/0xA6317eA7527e846cf0d47F66f1A29f20e9Fe27cB

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Paymaster Data from Alchemy.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0xac1f808deffef50dcadf59c2ed689e6c56f13a210e8631f098fb2df4f99b6ac9
UserOp Link: https://jiffyscan.xyz/userOpHash/0xac1f808deffef50dcadf59c2ed689e6c56f13a210e8631f098fb2df4f99b6ac9?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x49fbedf833cfecf9db7de56c61d4227292723115520600dbc3711da5e6a85672

Gas Used (Account or Paymaster): 419104
Gas Used (Transaction): 418779
```

## Native Transfer with Alchemy Paymaster (Gas Policy)

```
npm run alchemy:native-transfer:paymaster

> @safe-global/4337-gas-metering@1.0.0 alchemy:native-transfer:paymaster
> tsx ./alchemy/alchemy.ts native-transfer paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xA6317eA7527e846cf0d47F66f1A29f20e9Fe27cB
Address Link: https://sepolia.etherscan.io/address/0xA6317eA7527e846cf0d47F66f1A29f20e9Fe27cB

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Paymaster Data from Alchemy.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0x27978ad0d669dde49ea8b35a3db25e12360de6b2843b49b392f3da5946aa66ed
UserOp Link: https://jiffyscan.xyz/userOpHash/0x27978ad0d669dde49ea8b35a3db25e12360de6b2843b49b392f3da5946aa66ed?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x35f1e5b04d988e4614a17609190b3e21b0a9892f78da9f400248cfb3b5afde9a

Gas Used (Account or Paymaster): 130440
Gas Used (Transaction): 130202
```

## Safe Deployment + ERC20 Transaction with Alchemy Paymaster (Gas Policy)

```
npm run alchemy:erc20:paymaster          

> @safe-global/4337-gas-metering@1.0.0 alchemy:erc20:paymaster
> tsx ./alchemy/alchemy.ts erc20 paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xbF41EE996c17E6cC237C4186ABBcd9DCe197286B
Address Link: https://sepolia.etherscan.io/address/0xbF41EE996c17E6cC237C4186ABBcd9DCe197286B

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Paymaster Data from Alchemy.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0x34a820e77e07b698bc13c81d7f4872889d2330beeffd7c862f18e6073e19d7af
UserOp Link: https://jiffyscan.xyz/userOpHash/0x34a820e77e07b698bc13c81d7f4872889d2330beeffd7c862f18e6073e19d7af?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x7dda913ae986d49c4322f414102ae374441a40adb4b33727e568ba140904d52a

Gas Used (Account or Paymaster): 427047
Gas Used (Transaction): 421926
```

## ERC20 Transaction with Alchemy Paymaster (Gas Policy)

```
npm run alchemy:erc20:paymaster

> @safe-global/4337-gas-metering@1.0.0 alchemy:erc20:paymaster
> tsx ./alchemy/alchemy.ts erc20 paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xbF41EE996c17E6cC237C4186ABBcd9DCe197286B
Address Link: https://sepolia.etherscan.io/address/0xbF41EE996c17E6cC237C4186ABBcd9DCe197286B

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Paymaster Data from Alchemy.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0xab669bd1093de63befc2a9c453d366a35beba1275b5d5c7e2413cc7a779b6280
UserOp Link: https://jiffyscan.xyz/userOpHash/0xab669bd1093de63befc2a9c453d366a35beba1275b5d5c7e2413cc7a779b6280?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0xe34902ebd5377cac04c47d142f6ca2de558df63a7e0c6541f704df651b7cfcb1

Gas Used (Account or Paymaster): 138404
Gas Used (Transaction): 133394
```

## Safe Deployment + ERC721 Transaction with Alchemy Paymaster (Gas Policy)

```
npm run alchemy:erc721:paymaster

> @safe-global/4337-gas-metering@1.0.0 alchemy:erc721:paymaster
> tsx ./alchemy/alchemy.ts erc721 paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x6Bea0dbCcD353b648F2e5C09106B36C2351208c4
Address Link: https://sepolia.etherscan.io/address/0x6Bea0dbCcD353b648F2e5C09106B36C2351208c4

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Paymaster Data from Alchemy.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0xcb415603dee2458f4b2d0f69a83264758c8fded6c3a91ec6ac513153bccdf15b
UserOp Link: https://jiffyscan.xyz/userOpHash/0xcb415603dee2458f4b2d0f69a83264758c8fded6c3a91ec6ac513153bccdf15b?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0xb1253508bc4ca5ce41222b15b0e7bf03b2273bcb09d93e1d6d6a5ea39b43ee84

Gas Used (Account or Paymaster): 451515
Gas Used (Transaction): 451200
```

## ERC721 Transaction with Alchemy Paymaster (Gas Policy)

```
npm run alchemy:erc721:paymaster

> @safe-global/4337-gas-metering@1.0.0 alchemy:erc721:paymaster
> tsx ./alchemy/alchemy.ts erc721 paymaster=true

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x6Bea0dbCcD353b648F2e5C09106B36C2351208c4
Address Link: https://sepolia.etherscan.io/address/0x6Bea0dbCcD353b648F2e5C09106B36C2351208c4

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Paymaster Data Creation from Alchemy.

Received Paymaster Data from Alchemy.

Signed Real Data including Paymaster Data Created by Alchemy.

UserOperation submitted. Hash: 0x4404a43075c523e59f909acc7379c323eb1427b781bc48b5002007d167e63c83
UserOp Link: https://jiffyscan.xyz/userOpHash/0x4404a43075c523e59f909acc7379c323eb1427b781bc48b5002007d167e63c83?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0xd13fb70626a26aaa02e0389cd9347c1c0d8d8ed9ee794a61c5d3eea4b36e239a

Gas Used (Account or Paymaster): 162859
Gas Used (Transaction): 162654
```
