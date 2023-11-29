// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

library SafeOp {
    /**
     * @notice The SafeOp struct, representing the an ERC-4337 User Operation for the Safe.
     *  {address} safe - The address of the safe on which the operation is performed.
     *  {uint256} nonce - A unique number associated with the user operation, preventing replay attacks by ensuring each operation is unique.
     *  {bytes} callData - The bytes representing the data of the function call to be executed.
     *  {uint256} callGasLimit - The maximum amount of gas allowed for executing the function call.
     *  {uint256} verificationGasLimit - The maximum amount of gas allowed for the verification process.
     *  {uint256} preVerificationGas - The amount of gas allocated for pre-verification steps before executing the main operation.
     *  {uint256} maxFeePerGas - The maximum fee per gas that the user is willing to pay for the transaction.
     *  {uint256} maxPriorityFeePerGas - The maximum priority fee per gas that the user is willing to pay for the transaction.
     *  {bytes} paymasterAndData - The packed encoding of a paymaster address and its paymaster-specific data for sponsoring the user operation.
     *  {uint48} validAfter - A timestamp representing from when the user operation is valid.
     *  {uint48} validUntil - A timestamp representing until when the user operation is valid, or 0 to indicated "forever".
     *  {address} entryPoint - The address of the entry point that will execute the user operation.
     * @dev It is important that **all** user operation fields are represented in the `SafeOp` data somehow, to prevent
     * user operations from being submitted that do not fully respect the user preferences. The only exception is the
     * `signature` bytes. Note that even `initCode` needs to be represented in the operation data, otherwise it can be
     * replaced with a more expensive initialization that would charge the user additional fees.
     */
    struct Data {
        address safe;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        uint48 validAfter;
        uint48 validUntil;
    }

    /**
     * @notice The EIP-712 type-hash of the SafeOp struct.
     */
    bytes32 internal constant TYPEHASH =
        keccak256(
            "SafeOp(address safe,uint256 nonce,bytes callData,uint256 callGasLimit,uint256 verificationGasLimit,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,bytes paymasterAndData,uint48 validAfter,uint48 validUntil,address entryPoint)"
        );

    /**
     * @dev Computes the EIP-712 struct-hash for the Safe operation.
     * @param op The Safe operation to encode.
     * @return typeHash The Safe operation EIP-712 struct-hash.
     */
    function structHash(Data memory op) internal view returns (bytes32 opHash) {
        // We use the efficient in-place implementation suggested in the EIP: <https://eips.ethereum.org/EIPS/eip-712#rationale-for-encodedata>
        // Unfortunately, this means that this assembly is explicitely **not** memory Safe and we lose the posibility
        // of using the IR optimizer.

        bytes32 typeHash = TYPEHASH;
        bytes32 initCodeHash = keccak256(op.initCode);
        bytes32 callDataHash = keccak256(op.callData);
        bytes32 paymasterAndDataHash = keccak256(op.paymasterAndData);

        assembly {
            // Back up select memory
            let temp1 := mload(sub(op, 32))
            let temp2 := mload(add(op, 64))
            let temp2 := mload(add(op, 96))

            // Write typeHash and sub-hashes
            mstore(sub(mail, 32), typeHash)
            mstore(add(mail, 64), contentsHash)

            // Compute hash
            hash := keccak256(sub(mail, 32), 128)

            // Restore memory
            mstore(sub(mail, 32), temp1)
            mstore(add(mail, 64), temp2)
        }

        opHash = abi.encodePacked(
            bytes1(0x19),
            bytes1(0x01),
            domainSeparator(),
            keccak256(
                abi.encode(
                    SAFE_OP_TYPEHASH,
                    safe,
                    nonce,
                    keccak256(callData),
                    callGasLimit,
                    verificationGasLimit,
                    preVerificationGas,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                    keccak256(paymasterAndData),
                    validAfter,
                    validUntil,
                    SUPPORTED_ENTRYPOINT
                )
            )
        );
    }

    /**
     * @dev Returns the bytes to be hashed and signed by Safe owners.
     * @param op The Safe operation to encode.
     * @param domainSeparator The EIP-712 domain separator.
     * @return data Encoded operation data bytes.
     */
    function encode(Data memory op, bytes32 domainSeparator) internal view returns (bytes memory data) {
        data = abi.encodePacked(
            bytes1(0x19),
            bytes1(0x01),
            domainSeparator(),
            keccak256(
                abi.encode(
                    SAFE_OP_TYPEHASH,
                    safe,
                    nonce,
                    keccak256(callData),
                    callGasLimit,
                    verificationGasLimit,
                    preVerificationGas,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                    keccak256(paymasterAndData),
                    validAfter,
                    validUntil,
                    SUPPORTED_ENTRYPOINT
                )
            )
        );
    }
}
