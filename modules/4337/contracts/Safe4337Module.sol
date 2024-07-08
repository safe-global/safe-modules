// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.23;

import {HandlerContext} from "@safe-global/safe-contracts/contracts/handler/HandlerContext.sol";
import {CompatibilityFallbackHandler} from "@safe-global/safe-contracts/contracts/handler/CompatibilityFallbackHandler.sol";
import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
import {UserOperationLib} from "@account-abstraction/contracts/core/UserOperationLib.sol";
import {ISafe} from "./interfaces/Safe.sol";

/**
 * @title Safe4337Module - An extension to the Safe contract that implements the ERC4337 interface.
 * @dev The contract is both a module and fallback handler.
 *      Safe forwards the `validateUserOp` call to this contract, it validates the user operation and returns the result.
 *      It also executes a module transaction to pay the prefund. Similar flow for the actual operation execution.
 *      Security considerations:
 *      - The module is limited to the entry point address specified in the constructor.
 *      - The user operation hash is signed by the Safe owner(s) and validated by the module.
 *      - The user operation is not allowed to execute any other function than `executeUserOp` and `executeUserOpWithErrorString`.
 *      - Replay protection is handled by the entry point.
 * @custom:security-contact bounty@safe.global
 */
contract Safe4337Module is IAccount, HandlerContext, CompatibilityFallbackHandler {
    using UserOperationLib for PackedUserOperation;

    /**
     * @notice The EIP-712 type-hash for the domain separator used for verifying Safe operation signatures.
     * @dev keccak256("EIP712Domain(uint256 chainId,address verifyingContract)") = 0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218
     */
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = 0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218;

    /**
     * @notice The EIP-712 type-hash for a SafeOp, representing the structure of a User Operation for the Safe.
     *  {address} safe - The address of the safe on which the operation is performed.
     *  {uint256} nonce - A unique number associated with the user operation, preventing replay attacks by ensuring each operation is unique.
     *  {bytes} initCode - The packed encoding of a factory address and its factory-specific data for creating a new Safe account.
     *  {bytes} callData - The bytes representing the data of the function call to be executed.
     *  {uint128} verificationGasLimit - The maximum amount of gas allowed for the verification process.
     *  {uint128} callGasLimit - The maximum amount of gas allowed for executing the function call.
     *  {uint256} preVerificationGas - The amount of gas allocated for pre-verification steps before executing the main operation.
     *  {uint128} maxPriorityFeePerGas - The maximum priority fee per gas that the user is willing to pay for the transaction.
     *  {uint128} maxFeePerGas - The maximum fee per gas that the user is willing to pay for the transaction.
     *  {bytes} paymasterAndData - The packed encoding of a paymaster address and its paymaster-specific data for sponsoring the user operation.
     *  {uint48} validAfter - A timestamp representing from when the user operation is valid.
     *  {uint48} validUntil - A timestamp representing until when the user operation is valid, or 0 to indicated "forever".
     *  {address} entryPoint - The address of the entry point that will execute the user operation.
     * @dev When validating the user operation, the signature timestamps are pre-pended to the signature bytes. Equal to:
     * keccak256(
     *     "SafeOp(address safe,uint256 nonce,bytes initCode,bytes callData,uint128 verificationGasLimit,uint128 callGasLimit,uint256 preVerificationGas,uint128 maxPriorityFeePerGas,uint128 maxFeePerGas,bytes paymasterAndData,uint48 validAfter,uint48 validUntil,address entryPoint)"
     * ) = 0xc03dfc11d8b10bf9cf703d558958c8c42777f785d998c62060d85a4f0ef6ea7f
     */
    bytes32 private constant SAFE_OP_TYPEHASH = 0xc03dfc11d8b10bf9cf703d558958c8c42777f785d998c62060d85a4f0ef6ea7f;

    /**
     * @dev A structure used internally for manually encoding a Safe operation for when computing the EIP-712 struct hash.
     */
    struct EncodedSafeOpStruct {
        bytes32 typeHash;
        address safe;
        uint256 nonce;
        bytes32 initCodeHash;
        bytes32 callDataHash;
        uint128 verificationGasLimit;
        uint128 callGasLimit;
        uint256 preVerificationGas;
        uint128 maxPriorityFeePerGas;
        uint128 maxFeePerGas;
        bytes32 paymasterAndDataHash;
        uint48 validAfter;
        uint48 validUntil;
        address entryPoint;
    }

    /**
     * @notice An error indicating that the entry point used when deploying a new module instance is invalid.
     */
    error InvalidEntryPoint();

    /**
     * @notice An error indicating that the caller does not match the Safe in the corresponding user operation.
     * @dev This indicates that the module is being used to validate a user operation for a Safe that did not directly
     * call this module.
     */
    error InvalidCaller();

    /**
     * @notice An error indicating that the call validating or executing a user operation was not called by the
     * supported entry point contract.
     */
    error UnsupportedEntryPoint();

    /**
     * @notice An error indicating that the user operation `callData` does not correspond to one of the two supported
     * execution functions: `executeUserOp` or `executeUserOpWithErrorString`.
     */
    error UnsupportedExecutionFunction(bytes4 selector);

    /**
     * @notice An error indicating that the user operation failed to execute successfully.
     * @dev The contract reverts with this error when `executeUserOp` is used instead of bubbling up the original revert
     * data. When bubbling up revert data is desirable, `executeUserOpWithErrorString` should be used instead.
     */
    error ExecutionFailed();

    /**
     * @notice The address of the EntryPoint contract supported by this module.
     */
    address public immutable SUPPORTED_ENTRYPOINT;

    constructor(address entryPoint) {
        if (entryPoint == address(0)) {
            revert InvalidEntryPoint();
        }

        SUPPORTED_ENTRYPOINT = entryPoint;
    }

    /**
     * @notice Validates the call is initiated by the entry point.
     */
    modifier onlySupportedEntryPoint() {
        if (_msgSender() != SUPPORTED_ENTRYPOINT) {
            revert UnsupportedEntryPoint();
        }
        _;
    }

    /**
     * @notice Validates a user operation provided by the entry point.
     * @inheritdoc IAccount
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32,
        uint256 missingAccountFunds
    ) external onlySupportedEntryPoint returns (uint256 validationData) {
        address payable safeAddress = payable(userOp.sender);
        // The entry point address is appended to the calldata by the Safe in the `FallbackManager` contract,
        // following ERC-2771. Because of this, the relayer may manipulate the entry point address, therefore
        // we have to verify that the sender is the Safe specified in the userOperation.
        if (safeAddress != msg.sender) {
            revert InvalidCaller();
        }

        // We check the execution function signature to make sure the entry point can't call any other function
        // and make sure the execution of the user operation is handled by the module
        bytes4 selector = bytes4(userOp.callData);
        if (selector != this.executeUserOp.selector && selector != this.executeUserOpWithErrorString.selector) {
            revert UnsupportedExecutionFunction(selector);
        }

        // The userOp nonce is validated in the entry point (for 0.6.0+), therefore we will not check it again
        validationData = _validateSignatures(userOp);

        // We trust the entry point to set the correct prefund value, based on the operation params
        // We need to perform this even if the signature is not valid, else the simulation function of the entry point will not work.
        if (missingAccountFunds != 0) {
            // We intentionally ignore errors in paying the missing account funds, as the entry point is responsible for
            // verifying the prefund has been paid. This behaviour matches the reference base account implementation.
            ISafe(safeAddress).execTransactionFromModule(SUPPORTED_ENTRYPOINT, missingAccountFunds, "", 0);
        }
    }

    /**
     * @notice Executes a user operation provided by the entry point.
     * @param to Destination address of the user operation.
     * @param value Ether value of the user operation.
     * @param data Data payload of the user operation.
     * @param operation Operation type of the user operation.
     */
    function executeUserOp(address to, uint256 value, bytes memory data, uint8 operation) external onlySupportedEntryPoint {
        if (!ISafe(msg.sender).execTransactionFromModule(to, value, data, operation)) {
            revert ExecutionFailed();
        }
    }

    /**
     * @notice Executes a user operation provided by the entry point and returns error message on failure.
     * @param to Destination address of the user operation.
     * @param value Ether value of the user operation.
     * @param data Data payload of the user operation.
     * @param operation Operation type of the user operation.
     */
    function executeUserOpWithErrorString(address to, uint256 value, bytes memory data, uint8 operation) external onlySupportedEntryPoint {
        (bool success, bytes memory returnData) = ISafe(msg.sender).execTransactionFromModuleReturnData(to, value, data, operation);
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly ("memory-safe") {
                revert(add(returnData, 0x20), mload(returnData))
            }
        }
    }

    /**
     * @notice Computes the 32-byte domain separator used in EIP-712 signature verification for Safe operations.
     * @return domainSeparatorHash The EIP-712 domain separator hash for this contract.
     */
    function domainSeparator() public view returns (bytes32 domainSeparatorHash) {
        domainSeparatorHash = keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, this));
    }

    /**
     * @notice Returns the 32-byte Safe operation hash to be signed by owners for the specified ERC-4337 user operation.
     * @dev The Safe operation timestamps are pre-pended to the signature bytes as `abi.encodePacked(validAfter, validUntil, signatures)`.
     * @param userOp The ERC-4337 user operation.
     * @return operationHash Operation hash.
     */
    function getOperationHash(PackedUserOperation calldata userOp) external view returns (bytes32 operationHash) {
        (bytes memory operationData, , , ) = _getSafeOp(userOp);
        operationHash = keccak256(operationData);
    }

    /**
     * @dev Checks if the signatures length is correct and does not contain addtional bytes.
     * @param signatures signatures data
     * @param threshold Indicates the number of iterations to perform in the loop.
     * @return result True if length check passes, false otherwise.
     */
    function _checkSignatureLength(bytes calldata signatures, uint256 threshold) internal pure returns (bool result) {
        uint256 offset = threshold * 0x41;

        if (signatures.length < offset) return false;

        result = true;
        for (uint256 i = 0; i < threshold; i++) {
            /* solhint-disable no-inline-assembly */
            /// @solidity memory-safe-assembly
            assembly {
                let signaturePos := mul(0x41, i)
                let s := calldataload(add(signatures.offset, add(signaturePos, 0x20)))
                let v := byte(0, calldataload(add(signatures.offset, add(signaturePos, 0x40))))

                if iszero(v) {
                    // Require that the signature data pointer is pointing to the expected location, at the end of processed contract signatures.
                    result := eq(s, offset)
                    // Check if the contract signature is in bounds: start of data is s + 32 and end is start + signature length
                    let contractSignatureLen := calldataload(add(signatures.offset, s))
                    // Update the required position of the next offset.
                    offset := add(add(s, 0x20), contractSignatureLen)
                }
            }
            /* solhint-enable no-inline-assembly */
            if (!result) return result;
        }
        result = signatures.length <= offset;
    }

    /**
     * @dev Validates that the user operation is correctly signed and returns an ERC-4337 packed validation data
     * of `validAfter || validUntil || authorizer`:
     *  - `authorizer`: 20-byte address, 0 for valid signature or 1 to mark signature failure (this module does not make use of signature aggregators).
     *  - `validUntil`: 6-byte timestamp value, or zero for "infinite". The user operation is valid only up to this time.
     *  - `validAfter`: 6-byte timestamp. The user operation is valid only after this time.
     * @param userOp User operation struct.
     * @return validationData An integer indicating the result of the validation.
     */
    function _validateSignatures(PackedUserOperation calldata userOp) internal view returns (uint256 validationData) {
        (bytes memory operationData, uint48 validAfter, uint48 validUntil, bytes calldata signatures) = _getSafeOp(userOp);

        uint256 threshold = ISafe(payable(userOp.sender)).getThreshold();
        bool success = _checkSignatureLength(signatures, threshold);

        if (!success) {
            validationData = _packValidationData(true, validUntil, validAfter);
        } else {
            try ISafe(payable(userOp.sender)).checkSignatures(keccak256(operationData), operationData, signatures) {
                // The timestamps are validated by the entry point, therefore we will not check them again
                validationData = _packValidationData(false, validUntil, validAfter);
            } catch {
                validationData = _packValidationData(true, validUntil, validAfter);
            }
        }
    }

    /**
     * @dev Decodes an ERC-4337 user operation into a Safe operation.
     * @param userOp The ERC-4337 user operation.
     * @return operationData Encoded EIP-712 Safe operation data bytes used for signature verification.
     * @return validAfter The timestamp the user operation is valid from.
     * @return validUntil The timestamp the user operation is valid until.
     * @return signatures The Safe owner signatures extracted from the user operation.
     */
    function _getSafeOp(
        PackedUserOperation calldata userOp
    ) internal view returns (bytes memory operationData, uint48 validAfter, uint48 validUntil, bytes calldata signatures) {
        // Extract additional Safe operation fields from the user operation signature which is encoded as:
        // `abi.encodePacked(validAfter, validUntil, signatures)`
        {
            bytes calldata sig = userOp.signature;
            validAfter = uint48(bytes6(sig[0:6]));
            validUntil = uint48(bytes6(sig[6:12]));
            signatures = sig[12:];
        }

        // It is important that **all** user operation fields are represented in the `SafeOp` data somehow, to prevent
        // user operations from being submitted that do not fully respect the user preferences. The only exception is
        // the `signature` bytes. Note that even `initCode` needs to be represented in the operation data, otherwise
        // it can be replaced with a more expensive initialization that would charge the user additional fees.
        {
            // In order to work around Solidity "stack too deep" errors related to too many stack variables, manually
            // encode the `SafeOp` fields into a memory `struct` for computing the EIP-712 struct-hash. This works
            // because the `EncodedSafeOpStruct` struct has no "dynamic" fields so its memory layout is identical to the
            // result of `abi.encode`-ing the individual fields.
            EncodedSafeOpStruct memory encodedSafeOp = EncodedSafeOpStruct({
                typeHash: SAFE_OP_TYPEHASH,
                safe: userOp.sender,
                nonce: userOp.nonce,
                initCodeHash: keccak256(userOp.initCode),
                callDataHash: keccak256(userOp.callData),
                verificationGasLimit: uint128(userOp.unpackVerificationGasLimit()),
                callGasLimit: uint128(userOp.unpackCallGasLimit()),
                preVerificationGas: userOp.preVerificationGas,
                maxPriorityFeePerGas: uint128(userOp.unpackMaxPriorityFeePerGas()),
                maxFeePerGas: uint128(userOp.unpackMaxFeePerGas()),
                paymasterAndDataHash: keccak256(userOp.paymasterAndData),
                validAfter: validAfter,
                validUntil: validUntil,
                entryPoint: SUPPORTED_ENTRYPOINT
            });

            bytes32 safeOpStructHash;
            // solhint-disable-next-line no-inline-assembly
            assembly ("memory-safe") {
                // Since the `encodedSafeOp` value's memory layout is identical to the result of `abi.encode`-ing the
                // individual `SafeOp` fields, we can pass it directly to `keccak256`. Additionally, there are 14
                // 32-byte fields to hash, for a length of `14 * 32 = 448` bytes.
                safeOpStructHash := keccak256(encodedSafeOp, 448)
            }

            operationData = abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), safeOpStructHash);
        }
    }
}
