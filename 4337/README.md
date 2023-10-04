# Safe Module/Fallback handler for EIP4337 Support

The diagram below outlines the flow that is triggered when a user operation is submitted to via the entrypoint. Additionally the gas overhead compared to a native implementation is mentioned.

```mermaid
sequenceDiagram
    actor B as Bundler
    participant E as Entry Point
    participant P as Safe Proxy
    participant S as Safe Singleton
    participant M as 4337 Module
    actor T as Target
    B->>+E: Submit User Operations
    E->>+P: Validate User Operation
    P-->>S: Load Safe logic
        Note over P, M: Gas overhead for calls and storage access
    P->>+M: Forward validation
    Note over P, M: Load fallback handler ~2100 gas<br>Intital module access ~2600 gas
    M->>P: Check signatures
    P-->>S: Load Safe logic
    Note over P, M: Call to Safe Proxy ~100 gas<br>Load logic ~100 gas
    opt Pay required fee
        M->>P: Trigger fee payment
        P-->>S: Load Safe logic
        Note over P, M: Module check ~2100 gas<br>Call to Safe Proxy ~100 gas<br>Load logic ~100 gas
        P->>E: Perform fee payment
    end
    M-->>-P: Validation response
    P-->>-E: Validation response
        Note over P, M: Total gas overhead<br>Without fee payment ~4.900 gas<br>With fee payment ~7.200 gas
    Note over B, T: This execution flow is similar<br>for native 4337 support<br>therefore there is no gas overhead
    E->>+P: executeTransactionFromModule
    P-->>S: Load Safe logic
    P->>-T: Perform transaction
```

The gas overhead is based on [EIP-2929](https://eips.ethereum.org/EIPS/eip-2929). It is possible to reduce the gas overhead by using [access lists](https://eips.ethereum.org/EIPS/eip-2930).

Note: The gas overhead is only the very base line using storage access and call costs. As also additional costs occur to handle the storage access and calls the actual gas overhead is higher. The tests indicate an overhead of ~11.6k gas when a fee payment is required and 7.8k gas otherwise. This shows that there is still room for optimization in the contracts used in the tests.

## Usage

### Install requirements with yarn:

```bash
npm i
```

### Run all tests:

```bash
npm run build
npm run test
```

### Run script

```bash
npx hardhat run scripts/runOp.ts --network goerli
```

### Deploy

> :warning: **Make sure to use the correct commit when deploying the contracts.** Any change (even comments) within the contract files will result in different addresses. The tagged versions that are used by the Safe team can be found in the [releases](https://github.com/5afe/eip4337-diatomic/releases).

This will deploy the contracts deterministically and verify the contracts on etherscan using [Solidity 0.7.6](https://github.com/ethereum/solidity/releases/tag/v0.7.6) by default.

Preparation:

- Set `MNEMONIC` in `.env`
- Set `INFURA_KEY` in `.env`

```bash
npm run deploy-all <network>
```

This will perform the following steps

```bash
npm run build
npx hardhat --network <network> deploy
npx hardhat --network <network> etherscan-verify
npx hardhat --network <network> local-verify
```

#### Custom Networks

It is possible to use the `NODE_URL` env var to connect to any EVM based network via an RPC endpoint. This connection then can be used with the `custom` network.

E.g. to deploy the Safe contract suite on that network you would run `yarn deploy-all custom`.

The resulting addresses should be on all networks the same.

Note: Address will vary if contract code is changed or a different Solidity version is used.

### Verify contract

This command will use the deployment artifacts to compile the contracts and compare them to the onchain code

```bash
npx hardhat --network <network> local-verify
```

This command will upload the contract source to Etherescan

```bash
npx hardhat --network <network> etherscan-verify
```

## Documentation

- [Safe developer portal](http://docs.gnosis-safe.io)

## Security and Liability

All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

## License

All smart contracts are released under LGPL-3.0
