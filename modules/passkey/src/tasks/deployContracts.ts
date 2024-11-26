import { task } from 'hardhat/config'

task('deploy-contracts', 'Deploys and verifies Safe contracts').setAction(async (_, { deployments, run }) => {
  await run('deploy')
  await run('local-verify')

  // Unfortunately, the `etherscan-verify` task from the `hardhat-deploy` package cannot deal with
  // contracts compiled with different Solidity settings in the same project :/. We work around this
  // by first manually verifying the FCL P-256 verifier contract (which is the only contract that is
  // build with special Solidity settings) so that it is already verified and does not fail in the
  // `etherscan-verify` step below.
  const { address: fclP256Verifier } = await deployments.get('FCLP256Verifier')
  await run('verify', { address: fclP256Verifier, contract: 'contracts/verifiers/FCLP256Verifier.sol:FCLP256Verifier' })

  await run('etherscan-verify', { forceLicense: true, license: 'LGPL-3.0-only' })
  await run('sourcify')

  // The `SafeWebAuthnSignerSingleton` is deployed by the `SafeWebAuthnSignerFactory` contructor
  // and not by the deployment script, so it does not automatically get verified. We work around
  // this by manually using the `hardhat-verify` plugin to verify the contract on Etherscan.
  const signerSingleton = await deployments.read('SafeWebAuthnSignerFactory', 'SINGLETON')
  await run('verify', { address: signerSingleton, contract: 'contracts/SafeWebAuthnSignerSingleton.sol:SafeWebAuthnSignerSingleton' })
})

export {}
