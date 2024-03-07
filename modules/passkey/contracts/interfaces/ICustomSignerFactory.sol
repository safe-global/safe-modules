// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title ICustomECSignerFactory
 * @dev Interface for creating and verifying ECDSA signers. This is a generalized interface that should be
 *  compatible with curves of any order size. Currently not used in the project and exists here for reference.
 */
interface ICustomECSignerFactory {
    /**
     * @notice Gets the unique signer address for the specified data.
     * @dev The signer address should be unique for the given data. The signer does not need to be created yet.
     * @param data The signer-specific data.
     * @return signer The signer address.
     */
    function getSigner(bytes memory data) external view returns (address signer);

    /**
     * @notice Creates a new unique signer for the specified data.
     * @dev The signer address must be unique for the given data. This should not revert if the signer already exists.
     * @param data The signer-specific data.
     * @return signer The signer address.
     */
    function createSigner(bytes memory data) external returns (address signer);

    /**
     * @notice Verifies a signature for the specified address without deploying it.
     * @dev This should be equivalent to first deploying the signer with the factory, and then verifying the signature
     * with it directly: `factory.createSigner(signerData).isValidSignature(message, signature)`
     * @param message The signed message.
     * @param signature The signature bytes.
     * @param signerData The signer data to verify the signature for.
     * @return magicValue Returns the legacy EIP-1271 magic value (`bytes4(keccak256("isValidSignature(bytes,bytes)")`) when the signature is valid. Reverting or returning any other value implies an invalid signature.
     */
    function isValidSignatureForSigner(
        bytes32 message,
        bytes calldata signature,
        bytes calldata signerData
    ) external view returns (bytes4 magicValue);
}

/**
 * @title ICustom256BitECSignerFactory
 * @dev Interface for creating and verifying ECDSA signers using 256-bit elliptic curves.
 */
interface ICustom256BitECSignerFactory {
    /**
     * @notice Gets the unique signer address for the specified data.
     * @dev The unique signer address must be unique for some given data. The signer is not guaranteed to be created yet.
     * @param qx The x-coordinate of the public key.
     * @param qy The y-coordinate of the public key.
     * @param verifier The address of the verifier.
     * @return signer The signer address.
     */
    function getSigner(uint256 qx, uint256 qy, address verifier) external view returns (address signer);

    /**
     * @notice Create a new unique signer for the specified data.
     * @dev The unique signer address must be unique for some given data. This must not revert if the unique owner already exists.
     * @param qx The x-coordinate of the public key.
     * @param qy The y-coordinate of the public key.
     * @param verifier The address of the verifier.
     * @return signer The signer address.
     */
    function createSigner(uint256 qx, uint256 qy, address verifier) external returns (address signer);

    /**
     * @notice Verifies a signature for the specified address without deploying it.
     * @dev This must be equivalent to first deploying the signer with the factory, and then verifying the signature
     * with it directly: `factory.createSigner(signerData).isValidSignature(message, signature)`
     * @param qx The x-coordinate of the public key.
     * @param qy The y-coordinate of the public key.
     * @param verifier The address of the verifier.
     * @param message The signed message.
     * @param signature The signature bytes.
     * @return magicValue Returns a legacy EIP-1271 magic value (`bytes4(keccak256(isValidSignature(bytes,bytes))`) when the signature is valid. Reverting or returning any other value implies an invalid signature.
     */
    function isValidSignatureForSigner(
        uint256 qx,
        uint256 qy,
        address verifier,
        bytes32 message,
        bytes calldata signature
    ) external view returns (bytes4 magicValue);
}
