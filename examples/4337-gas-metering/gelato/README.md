# Gelato

## Safe Deployment with Gelato

```
pnpm run gelato:account:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:account:1balance
> tsx ./gelato/gelato.ts account

Signer Extracted from Private Key.

Appropriate calldata created.

Init Code Created.

Appropriate calldata created.

Counterfactual Sender Address Created: 0x22e75eC3A05a8e3e1aD2307eb4422247C538ff06
Address Link: https://base-sepolia.etherscan.io/address/0x22e75eC3A05a8e3e1aD2307eb4422247C538ff06

Appropriate preparation done for transaction.

Deploying a new Safe and executing calldata passed with it (if any).

Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0x464e255d4b46e628c61af8bf82c12f6364b3bfe72d2566c9e8939503c9b2fd88

Transaction Link: https://sepolia.basescan.org/tx/0x1b2f743dff63dfc6e01e18623cb8d692d4a1cf206008358fac3eaf8fd5957c91

Gas Used: https://dashboard.tenderly.co/tx/base-sepolia/0x1b2f743dff63dfc6e01e18623cb8d692d4a1cf206008358fac3eaf8fd5957c91/gas-usage

Gas Used: 302679
```

## Safe Deployment + Native Transfer with Gelato

```
pnpm run gelato:native-transfer:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:native-transfer:1balance
> tsx ./gelato/gelato.ts native-transfer

Signer Extracted from Private Key.

Appropriate calldata created.

Init Code Created.

Appropriate calldata created.

Counterfactual Sender Address Created: 0x7e10D140a779c67B3d92F7b29B83e97C29f26C2a
Address Link: https://base-sepolia.etherscan.io/address/0x7e10D140a779c67B3d92F7b29B83e97C29f26C2a

Transferring 0.000001 ETH to Safe for native transfer.

Transferred required ETH for the native transfer.

Appropriate preparation done for transaction.

Deploying a new Safe and executing calldata passed with it (if any).

Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0xd025a1a9ec04268ac6ba5aace0eac78f003523b5f9481513042b09ed7cc06b94

Transaction Link: https://sepolia.basescan.org/tx/0xddbd655b8a11cf043c535c2d6dbe14aa82925d444a0d4bb5378670993ad1862c

Gas Used: https://dashboard.tenderly.co/tx/base-sepolia/0xddbd655b8a11cf043c535c2d6dbe14aa82925d444a0d4bb5378670993ad1862c/gas-usage

Gas Used: 313228
```

## Native Transfer with Gelato

```
pnpm run gelato:native-transfer:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:native-transfer:1balance
> tsx ./gelato/gelato.ts native-transfer

Signer Extracted from Private Key.

Appropriate calldata created.

Init Code Created.

Appropriate calldata created.

Counterfactual Sender Address Created: 0x7e10D140a779c67B3d92F7b29B83e97C29f26C2a
Address Link: https://base-sepolia.etherscan.io/address/0x7e10D140a779c67B3d92F7b29B83e97C29f26C2a

Transferring 0.000001 ETH to Safe for native transfer.

Transferred required ETH for the native transfer.

Appropriate preparation done for transaction.

The Safe is already deployed.

Executing calldata passed with the Safe.

Appropriate calldata created.

Signature for Call Data created.

Signed Calldata Created.

Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0x1d15b1b4effcd5960ad5e2f2ebec03e906f150fbc0b01491d12e8871dcf1134b

Transaction Link: https://sepolia.basescan.org/tx/0x162b8817fe9cbbccb905c4b51cc25cbf2625afa1e5341087a4e79b9bb6834fc6

Gas Used: https://dashboard.tenderly.co/tx/base-sepolia/0x162b8817fe9cbbccb905c4b51cc25cbf2625afa1e5341087a4e79b9bb6834fc6/gas-usage

Gas Used: 83930
```

## Safe Deployment + ERC20 Transaction with Gelato

```
pnpm run gelato:erc20:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:erc20:1balance
> tsx ./gelato/gelato.ts erc20

Signer Extracted from Private Key.

Appropriate calldata created.

Init Code Created.

Appropriate calldata created.

Counterfactual Sender Address Created: 0x3515D6c410dB9b457f52535D7364828b944d3307
Address Link: https://base-sepolia.etherscan.io/address/0x3515D6c410dB9b457f52535D7364828b944d3307

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate preparation done for transaction.

Deploying a new Safe and executing calldata passed with it (if any).

Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0xd13ca2a2d98685e8762a4d836b066acb5e80c35d5aeb392dd9db739e546a27eb

Transaction Link: https://sepolia.basescan.org/tx/0x1043acb58c89667d26360f23532d6eee4ab927b20ba37035fb3ffb8cc71c224b

Gas Used: https://dashboard.tenderly.co/tx/base-sepolia/0x1043acb58c89667d26360f23532d6eee4ab927b20ba37035fb3ffb8cc71c224b/gas-usage

Gas Used: 315961
```

## ERC20 Transaction with Gelato

```
pnpm run gelato:erc20:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:erc20:1balance
> tsx ./gelato/gelato.ts erc20

Signer Extracted from Private Key.

Appropriate calldata created.

Init Code Created.

Appropriate calldata created.

Counterfactual Sender Address Created: 0x3515D6c410dB9b457f52535D7364828b944d3307
Address Link: https://base-sepolia.etherscan.io/address/0x3515D6c410dB9b457f52535D7364828b944d3307

Safe Wallet ERC20 Balance: 0

Minting ERC20 Tokens to Safe Wallet.

Updated Safe Wallet ERC20 Balance: 1

Appropriate preparation done for transaction.

The Safe is already deployed.

Executing calldata passed with the Safe.

Appropriate calldata created.

Signature for Call Data created.

Signed Calldata Created.

Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0x94b1fcd1a5e6effeaf3e4f89cf09462ea3dff41d02fbc381b2185a32db957f16

Transaction Link: https://sepolia.basescan.org/tx/0x6c6ccadea5e54aa47b36c603132b315f1cf15e75e96c0376a7c76ae48f69a006

Gas Used: https://dashboard.tenderly.co/tx/base-sepolia/0x6c6ccadea5e54aa47b36c603132b315f1cf15e75e96c0376a7c76ae48f69a006/gas-usage

Gas Used: 86852
```

## Safe Deployment + ERC721 Transaction with Gelato

```
pnpm run gelato:erc721:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:erc721:1balance
> tsx ./gelato/gelato.ts erc721

Signer Extracted from Private Key.

Appropriate calldata created.

Init Code Created.

Appropriate calldata created.

Counterfactual Sender Address Created: 0xD22Dc144F6fB5c827AFb4f07C44AaA332a95dB58
Address Link: https://base-sepolia.etherscan.io/address/0xD22Dc144F6fB5c827AFb4f07C44AaA332a95dB58

Appropriate preparation done for transaction.

Deploying a new Safe and executing calldata passed with it (if any).

Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0xde7362ff56afdeeefffbb8797b3f8701ff91b6d8ff08cfb4d46d1565a1cee7cf

Transaction Link: https://sepolia.basescan.org/tx/0xd49b482ff37f07f12fc1688a2af33b4451d63409fe547f9cf2e660422866da3e

Gas Used: https://dashboard.tenderly.co/tx/base-sepolia/0xd49b482ff37f07f12fc1688a2af33b4451d63409fe547f9cf2e660422866da3e/gas-usage

Gas Used: 345284
```

## ERC721 Transaction with Gelato

```
pnpm run gelato:erc721:1balance

> @safe-global/4337-gas-metering@1.0.0 gelato:erc721:1balance
> tsx ./gelato/gelato.ts erc721

Signer Extracted from Private Key.

Appropriate calldata created.

Init Code Created.

Appropriate calldata created.

Counterfactual Sender Address Created: 0xD22Dc144F6fB5c827AFb4f07C44AaA332a95dB58
Address Link: https://base-sepolia.etherscan.io/address/0xD22Dc144F6fB5c827AFb4f07C44AaA332a95dB58

Appropriate preparation done for transaction.

The Safe is already deployed.

Executing calldata passed with the Safe.

Appropriate calldata created.

Signature for Call Data created.

Signed Calldata Created.

Gelato Relay Task Link: https://api.gelato.digital/tasks/status/0x00d92c5c933044fc50de6e89842241d830f2297a912753fc43803028f539d392

Transaction Link: https://sepolia.basescan.org/tx/0x5814be99c937b6e7386f3526fe9f11fc1bf7a21180daf66ee2e44cc1e4d0da3d

Gas Used: https://dashboard.tenderly.co/tx/base-sepolia/0x5814be99c937b6e7386f3526fe9f11fc1bf7a21180daf66ee2e44cc1e4d0da3d/gas-usage

Gas Used: 116159
```
