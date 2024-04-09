// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title Custom ECDSA Signer Factory
 * @dev Interface for a factory contract that can create ERC-1271 compatible signers, and verify
 * signatures for custom ECDSA schemes.
 * @custom:security-contact bounty@safe.global
 */
interface ICustomECDSASignerProxyFactory {
    /**
     * @notice Gets the unique signer address for the specified data.
     * @dev The unique signer address must be unique for some given data. The signer is not
     * guaranteed to be created yet.
     * @param singleton The address of the singleton implementation.
     * @param x The x-coordinate of the public key.
     * @param y The y-coordinate of the public key.
     * @param verifier The address of the verifier.
     * @return signer The signer address.
     */
    function getSigner(address singleton, uint256 x, uint256 y, address verifier) external view returns (address signer);

    /**
     * @notice Create a new unique signer for the specified data.
     * @dev The unique signer address must be unique for some given data. This must not revert if
     * the unique owner already exists.
     * @param singleton The address of the singleton implementation.
     * @param x The x-coordinate of the public key.
     * @param y The y-coordinate of the public key.
     * @param verifier The address of the verifier.
     * @return signer The signer address.
     */
    function createSigner(address singleton, uint256 x, uint256 y, address verifier) external returns (address signer);

    /**
     * @notice Verifies a signature for the specified address without deploying it.
     * @dev This must be equivalent to first deploying the signer with the factory, and then
     * verifying the signature with it directly:
     * `factory.createSigner(signerData).isValidSignature(message, signature)`
     * @param message The signed message.
     * @param signature The signature bytes.
     * @param x The x-coordinate of the public key.
     * @param y The y-coordinate of the public key.
     * @param verifier The address of the verifier.
     * @return magicValue Returns the ERC-1271 magic value when the signature is valid. Reverting or
     * returning any other value implies an invalid signature.
     */
    function isValidSignatureForSigner(
        bytes32 message,
        bytes calldata signature,
        uint256 x,
        uint256 y,
        address verifier
    ) external view returns (bytes4 magicValue);
}
