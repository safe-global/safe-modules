# Pimlico Paymaster Analysis

## Safe Deployment with Pimlico Paymaster (USDC)

```
npm run pimlico:account

> @safe-global/aa-analysis@1.0.0 pimlico:account
> tsx ./pimlico/pimlico-account.ts

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x3680E646f69c94269540AB157C18B7C271D14E6d
Address Link: https://goerli.etherscan.io/address/0x3680E646f69c94269540AB157C18B7C271D14E6d

Safe Wallet ERC20 Balance: 0

Please deposit atleast 1 USDC Token for paying the Paymaster.

Updated Safe Wallet USDC Balance: 1

Nonce for the sender received from EntryPoint.

Deploying a new Safe.

UserOperation submitted. Hash: 0xda816afbbb3d3daffe3049d1f661f423a9cc30f6de3d43e3bf2394f1311dcbbc
UserOp Link: https://jiffyscan.xyz/userOpHash/0xda816afbbb3d3daffe3049d1f661f423a9cc30f6de3d43e3bf2394f1311dcbbc?network=goerli

Querying for receipts...
Receipt found!
Transaction hash: 0x6ed6566395a3525a860207bc4a26ab3f568dcf787de4f8477cac9ad667af9cd1
Transaction Link: https://goerli.etherscan.io/tx/0x6ed6566395a3525a860207bc4a26ab3f568dcf787de4f8477cac9ad667af9cd1
```

Gas Usage: 499796

## Safe Deployment + ERC20 Transaction with Pimlico Paymaster (USDC)

```
npm run pimlico:erc20

> @safe-global/aa-analysis@1.0.0 pimlico:erc20
> tsx ./pimlico/pimlico-erc20.ts

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x466e2F6ccF2e7B6d44a51b0C6072Ed597154Ec4c
Address Link: https://goerli.etherscan.io/address/0x466e2F6ccF2e7B6d44a51b0C6072Ed597154Ec4c

Safe Wallet USDC Balance: 0

Please deposit atleast 1 USDC Token for paying the Paymaster.

Updated Safe Wallet USDC Balance: 1

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Nonce for the sender received from EntryPoint.

Deploying a new Safe and transfering 1 ERC20 from Safe to Signer in one tx.

UserOperation submitted. Hash: 0xab76c14cd3d8fa6dae9202b5f3f52fb6aae2e0050240efb9300d9cf32861c040
UserOp Link: https://jiffyscan.xyz/userOpHash/0xab76c14cd3d8fa6dae9202b5f3f52fb6aae2e0050240efb9300d9cf32861c040?network=goerli

Querying for receipts...
Receipt found!
Transaction hash: 0x07d650f552c115aadc18c717eb1e64bec69ea5a49c760a02ff7ae392a154b03a
Transaction Link: https://goerli.etherscan.io/tx/0x07d650f552c115aadc18c717eb1e64bec69ea5a49c760a02ff7ae392a154b03a
```

Gas Usage: 511091

## ERC20 Transaction with Pimlico Paymaster (USDC)

```
npm run pimlico:erc20

> @safe-global/aa-analysis@1.0.0 pimlico:erc20
> tsx ./pimlico/pimlico-erc20.ts

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xcdf86Aa2002e56A3F9e37A9a28CA91cdfC1994ac
Address Link: https://goerli.etherscan.io/address/0xcdf86Aa2002e56A3F9e37A9a28CA91cdfC1994ac

Safe Wallet USDC Balance: 2

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Nonce for the sender received from EntryPoint.

The Safe is already deployed. Sending 1 USDC from the Safe to itself.

UserOperation submitted. Hash: 0xb1c4a82e42e0b5c11853b22a8699717ab5fea4b5189932b9960a676a01490403
UserOp Link: https://jiffyscan.xyz/userOpHash/0xb1c4a82e42e0b5c11853b22a8699717ab5fea4b5189932b9960a676a01490403?network=goerli

Querying for receipts...
Receipt found!
Transaction hash: 0x8cf80187949edd0306bbf21fc998cbbedf59f0f3a4f51a67013536db98bc339d
Transaction Link: https://goerli.etherscan.io/tx/0x8cf80187949edd0306bbf21fc998cbbedf59f0f3a4f51a67013536db98bc339d
```

Gas Usage: 200038

## Safe Deployment + ERC721 Transaction with Pimlico Paymaster (USDC)

```
npm run pimlico:erc721

> @safe-global/aa-analysis@1.0.0 pimlico:erc721
> tsx ./pimlico/pimlico-erc721.ts

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x6633A7dD8122bbb7802984D3787f1D87e52c9cDb
Address Link: https://goerli.etherscan.io/address/0x6633A7dD8122bbb7802984D3787f1D87e52c9cDb

Safe Wallet USDC Balance: 0

Please deposit atleast 2 USDC Token for paying the Paymaster.

Updated Safe Wallet USDC Balance: 2

Nonce for the sender received from EntryPoint.
Deploying a new Safe and Minting 1 ERC721 Token to the Safe in one tx
UserOperation submitted. Hash: 0x4e587fa1e1598f8f02f9e6d9f19091a5355b45c703e857b6d344181d0e124c88
UserOp Link: https://jiffyscan.xyz/userOpHash/0x4e587fa1e1598f8f02f9e6d9f19091a5355b45c703e857b6d344181d0e124c88?network=goerli

Querying for receipts...
Receipt found!
Transaction hash: 0x63bdc3173c90ed3bff9f7c889156914d482c0fce2652fa006271d2aa0c25fa8d
Transaction Link: https://goerli.etherscan.io/tx/0x63bdc3173c90ed3bff9f7c889156914d482c0fce2652fa006271d2aa0c25fa8d
```

Gas Usage: 558029

## ERC721 Transaction with Pimlico Paymaster (USDC)

```
npm run pimlico:erc721

> @safe-global/aa-analysis@1.0.0 pimlico:erc721
> tsx ./pimlico/pimlico-erc721.ts

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x6633A7dD8122bbb7802984D3787f1D87e52c9cDb
Address Link: https://goerli.etherscan.io/address/0x6633A7dD8122bbb7802984D3787f1D87e52c9cDb

Safe Wallet USDC Balance: 1

Please deposit atleast 2 USDC Token for paying the Paymaster.

Updated Safe Wallet USDC Balance: 2

Nonce for the sender received from EntryPoint.
The Safe is already deployed. Minting 1 ERC721 Token to the Safe.
UserOperation submitted. Hash: 0xee2a5f5f415273d661440d402f6bc8f6303870651a8790ebb745aeeda031bfc4
UserOp Link: https://jiffyscan.xyz/userOpHash/0xee2a5f5f415273d661440d402f6bc8f6303870651a8790ebb745aeeda031bfc4?network=goerli

Querying for receipts...
Receipt found!
Transaction hash: 0x553dbe52083f5e56bc75eaf389812df810a4556ecd291d7310f17335d8ebb928
Transaction Link: https://goerli.etherscan.io/tx/0x553dbe52083f5e56bc75eaf389812df810a4556ecd291d7310f17335d8ebb928
```

Gas Usage: 229913
