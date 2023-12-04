# Paymaster Analysis

## How to run?

1. Rename the `.env.example` to `.env`.
2. Fill the required values of `.env`.
3. Based on which paymaster to run, check the `package.json` file to see the script. Further, you can check the `README.md` files in the corresponding paymaster folders to see the individual command.

NOTE: If you run a paymaster analysis twice or more without changing the salt for Safe Creation, then only the operation will execute through paymaster, rather than Safe Creation and Operation.

## Gas Usage Results

| Type of Transaction | Without Paymaster | Pimlico (USDC Paymaster) | Alchemy (ETH Paymaster) |
|---|---|---|---|
| Safe Deployment with 4337 Module | 358975 | [499796](https://goerli.etherscan.io/tx/0x6ed6566395a3525a860207bc4a26ab3f568dcf787de4f8477cac9ad667af9cd1) | [408370](https://sepolia.etherscan.io/tx/0x7dfffc6893755ec533cb3488abbc4ed155dccc2d91e22ab86b445ae06ef943aa) |
| Safe Deployment with 4337 Module + ERC20 Transfer | 369890 | [511091](https://goerli.etherscan.io/tx/0x07d650f552c115aadc18c717eb1e64bec69ea5a49c760a02ff7ae392a154b03a) | [419691](https://sepolia.etherscan.io/tx/0xd5fa12e541394fe893b068c03d030c4bdcc3ff269de56b20153954246039b8eb) |
| ERC20 Transfer using Safe with 4337 Module Enabled | 93674 | [200038](https://goerli.etherscan.io/tx/0x8cf80187949edd0306bbf21fc998cbbedf59f0f3a4f51a67013536db98bc339d) | [131418](https://sepolia.etherscan.io/tx/0xb2bea2d2ec6b8d9b8cdb62e119a94ff8829b718f6f818e41c2170bba04fb33e2) |
| Safe Deployment with 4337 Module + ERC721 Minting | 411677 | [558029](https://goerli.etherscan.io/tx/0x63bdc3173c90ed3bff9f7c889156914d482c0fce2652fa006271d2aa0c25fa8d) | [448953](https://sepolia.etherscan.io/tx/0x24e1f66c2da65d53bef53f70935b270892e451827dc3ed382d4990598aa11eba) |
| ERC721 Minting using Safe with 4337 Module Enabled | 135449 | [229913](https://goerli.etherscan.io/tx/0x553dbe52083f5e56bc75eaf389812df810a4556ecd291d7310f17335d8ebb928) | [194878](https://sepolia.etherscan.io/tx/0xf002a715320c8ebc181e2debedf86eafd335c5d0163f79d628f994f7023ee8e1) |
|  |  |  |  |