# Safe + 4337 + Passkeys example application

This minimalistic example application demonstrates a Safe{Core} Smart Account deployment leveraging 4337 and Passkeys. It uses experimental and unaudited (at the moment of writing) contracts: [TestWebAuthnSingletonSigner](https://github.com/safe-global/safe-modules/blob/64fda14111b800ec23b48d93a1288324725fd579/modules/passkey/contracts/test/TestWebAuthnSingletonSigner.sol) and [TestStakedFactory](https://github.com/safe-global/safe-modules/blob/64fda14111b800ec23b48d93a1288324725fd579/modules/4337/contracts/test/TestStakedFactory.sol). The `TestWebAuthnSingletonSigner` allows specifying any signature verifier, including the precompile, but the app chooses to use [FreshCryptoLib](https://github.com/rdubois-crypto/FreshCryptoLib/) verifier under the hood.

## Running the app

### Clone the repository

```bash
git clone https://github.com/safe-global/safe-modules.git
cd safe-modules
```

### Install dependencies

```bash
npm install
```

### Fill in the environment variables

```bash
cp .env.example .env
```

and fill in the variables in `.env` file.

Helpful links:

- 4337 Bundler: https://www.pimlico.io/
- WalletConnect: https://cloud.walletconnect.com/

### Run the app in development mode

```bash
npm run dev -w examples/4337-passkeys-singleton-signer
```

## Config adjustments

The application depends on a specific set of contracts deployed on a specific network. If you want to use your own contracts, you need to adjust the configuration in `src/config.ts` file.
