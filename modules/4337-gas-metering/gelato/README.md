# Gelato

## Safe Deployment with Gelato

```
npm run gelato:account:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:account:1balance
> tsx ./gelato/gelato.ts account

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x8Af37a939fBEd9ac9AdB04270EF28DC844256CB3
Address Link: https://sepolia.etherscan.io/address/0x8Af37a939fBEd9ac9AdB04270EF28DC844256CB3

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Gelato.

Received Gas Data from Gelato.

Signed Real Data for Gelato.

UserOperation submitted.

Gelato Relay Task ID: 0x55def6ec01815152dfbf4f943f21e164559d79a974789e1a647aa7394fa80984
Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0x55def6ec01815152dfbf4f943f21e164559d79a974789e1a647aa7394fa80984

User OP Hash: 0xf46f8a12a949bf36e9584c8e40772162c3530ce4f72542e9da3b672ccce9019a
UserOp Link: https://jiffyscan.xyz/userOpHash/0xf46f8a12a949bf36e9584c8e40772162c3530ce4f72542e9da3b672ccce9019a?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x21205216b55d0f48aa09ff4289ae982c3b16e7a9905494815cabd1fb01a0d505

Gas Used (Account or Paymaster): 397421
Gas Used (Transaction): 397421
```

## Safe Deployment + Native Transfer with Gelato

```
npm run gelato:native-transfer:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:native-transfer:1balance
> tsx ./gelato/gelato.ts native-transfer

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x8652734F7404E97FEe69cf617286C5423593Bad0
Address Link: https://sepolia.etherscan.io/address/0x8652734F7404E97FEe69cf617286C5423593Bad0

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Transferring 0.000001 ETH to Safe for native transfer.

Transferred required ETH for the native transfer.

Appropriate calldata created.

Signed Dummy Data for Gelato.

Received Gas Data from Gelato.

Signed Real Data for Gelato.

UserOperation submitted.

Gelato Relay Task ID: 0x64080f3741400714cc10a6ca486e22467a2a879935c19268d6f1fe709e7f6ad8
Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0x64080f3741400714cc10a6ca486e22467a2a879935c19268d6f1fe709e7f6ad8

User OP Hash: 0x2126e36afaeae4190df1e540613aa972f8d73b37d9268ee089f4440db23ae74b
UserOp Link: https://jiffyscan.xyz/userOpHash/0x2126e36afaeae4190df1e540613aa972f8d73b37d9268ee089f4440db23ae74b?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x7bb36c93d21c911a2c1bdc7e50f55030cc7f006a1f7e2e651251dca9651383e0

Gas Used (Account or Paymaster): 404828
Gas Used (Transaction): 404828
```

## Native Transfer with Gelato

```
npm run gelato:native-transfer:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:native-transfer:1balance
> tsx ./gelato/gelato.ts native-transfer

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0x8652734F7404E97FEe69cf617286C5423593Bad0
Address Link: https://sepolia.etherscan.io/address/0x8652734F7404E97FEe69cf617286C5423593Bad0

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Transferring 0.000001 ETH to Safe for native transfer.

Transferred required ETH for the native transfer.

Appropriate calldata created.

Signed Dummy Data for Gelato.

Received Gas Data from Gelato.

Signed Real Data for Gelato.

UserOperation submitted.

Gelato Relay Task ID: 0xa2d246b5deabbcc4378f3fd3f1fe9bf1ddae3a6b4e286d7f759c27e558562754
Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0xa2d246b5deabbcc4378f3fd3f1fe9bf1ddae3a6b4e286d7f759c27e558562754

User OP Hash: 0xc9c86bcbe24adf9e67fbe199dd2cb9abe7cff12634f76df68aa98ee28193ac48
UserOp Link: https://jiffyscan.xyz/userOpHash/0xc9c86bcbe24adf9e67fbe199dd2cb9abe7cff12634f76df68aa98ee28193ac48?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0xefa122224466e9f1d09d42683aaec2b37f9871f7f5569099f0cc066961b39f15

Gas Used (Account or Paymaster): 114692
Gas Used (Transaction): 114692
```

## Safe Deployment + ERC20 Transaction with Gelato

```
npm run gelato:erc20:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:erc20:1balance
> tsx ./gelato/gelato.ts erc20

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xe86D78002637143c34d0687890c1b102D054a614
Address Link: https://sepolia.etherscan.io/address/0xe86D78002637143c34d0687890c1b102D054a614

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.

Signed Dummy Data for Gelato.

Received Gas Data from Gelato.

Signed Real Data for Gelato.

UserOperation submitted.

Gelato Relay Task ID: 0x02da9332b8528ce750fe2db6f245c90854fa5daa339911bc3b12691728bafb1b
Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0x02da9332b8528ce750fe2db6f245c90854fa5daa339911bc3b12691728bafb1b

User OP Hash: 0xf6d06a5723198af02f26a2daa0a6eec019ab539cfb97277a6aa5251e40863aa2
UserOp Link: https://jiffyscan.xyz/userOpHash/0xf6d06a5723198af02f26a2daa0a6eec019ab539cfb97277a6aa5251e40863aa2?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x4f55488ecc542be4effc2d7a4743345db6790ef80e7ca94f3e939a290738fa2d

Gas Used (Account or Paymaster): 408160
Gas Used (Transaction): 408160
```

## ERC20 Transaction with Gelato

```
npm run gelato:erc20:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:erc20:1balance
> tsx ./gelato/gelato.ts erc20

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xe86D78002637143c34d0687890c1b102D054a614
Address Link: https://sepolia.etherscan.io/address/0xe86D78002637143c34d0687890c1b102D054a614

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate calldata created.

Signed Dummy Data for Gelato.

Received Gas Data from Gelato.

Signed Real Data for Gelato.

UserOperation submitted.

Gelato Relay Task ID: 0x5f2e04dae7ec76037e22d250bcca19600b7c0cad4dcddc8015e629c69c22c2b3
Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0x5f2e04dae7ec76037e22d250bcca19600b7c0cad4dcddc8015e629c69c22c2b3

User OP Hash: 0x129341b16c3d7ffdafe17eb3bcae112eebc087ca4fef61ba503b7e460f3f12c4
UserOp Link: https://jiffyscan.xyz/userOpHash/0x129341b16c3d7ffdafe17eb3bcae112eebc087ca4fef61ba503b7e460f3f12c4?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x152c78871b6940215ba37cac5f5231fa2bd4bcf40742ebcf741903ce64adc405

Gas Used (Account or Paymaster): 118033
Gas Used (Transaction): 118033
```

## Safe Deployment + ERC721 Transaction with Gelato

```
npm run gelato:erc721:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:erc721:1balance
> tsx ./gelato/gelato.ts erc721

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xC8D65452DC04F13E2915916699f5B61fF647C163
Address Link: https://sepolia.etherscan.io/address/0xC8D65452DC04F13E2915916699f5B61fF647C163

Deploying a new Safe and executing calldata passed with it (if any).

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Gelato.

Received Gas Data from Gelato.

Signed Real Data for Gelato.

UserOperation submitted.

Gelato Relay Task ID: 0xe06c299ab9deac8ee76e40960af3b56b219dabd97488a67093a752376271fe3a
Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0xe06c299ab9deac8ee76e40960af3b56b219dabd97488a67093a752376271fe3a

User OP Hash: 0xae2b1d74f3e3e921f47db23c28f7c3f100bcaf8fe164d16ddd6b562b22519afb
UserOp Link: https://jiffyscan.xyz/userOpHash/0xae2b1d74f3e3e921f47db23c28f7c3f100bcaf8fe164d16ddd6b562b22519afb?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0x4aa37845d5c9fc0ad0713caefbbc9931263040d1502f076a98c993282257e51d

Gas Used (Account or Paymaster): 437372
Gas Used (Transaction): 437372
```

## ERC721 Transaction with Gelato

```
npm run gelato:erc721:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:erc721:1balance
> tsx ./gelato/gelato.ts erc721

Signer Extracted from Private Key.

Init Code Created.

Counterfactual Sender Address Created: 0xC8D65452DC04F13E2915916699f5B61fF647C163
Address Link: https://sepolia.etherscan.io/address/0xC8D65452DC04F13E2915916699f5B61fF647C163

The Safe is already deployed.

Nonce for the sender received from EntryPoint.

Appropriate calldata created.

Signed Dummy Data for Gelato.

Received Gas Data from Gelato.

Signed Real Data for Gelato.

UserOperation submitted.

Gelato Relay Task ID: 0xe201bbab015baeeaeab68f2e3a2c6e1cfe7af6704df0106b9fd3c9587c6ef61e
Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0xe201bbab015baeeaeab68f2e3a2c6e1cfe7af6704df0106b9fd3c9587c6ef61e

User OP Hash: 0x00d0e383c622a7e3b5c010ce915b300bf182988c6914a10b06efa1b933fd7d21
UserOp Link: https://jiffyscan.xyz/userOpHash/0x00d0e383c622a7e3b5c010ce915b300bf182988c6914a10b06efa1b933fd7d21?network=sepolia

Transaction Link: https://sepolia.etherscan.io/tx/0xfac73b16d0932ba97a93f12ddc230024b102e581a37a53625dfe8108ca581bb5

Gas Used (Account or Paymaster): 147232
Gas Used (Transaction): 147232
```
