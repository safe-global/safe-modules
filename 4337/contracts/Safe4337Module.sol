// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {HandlerContext} from "@safe-global/safe-contracts/contracts/handler/HandlerContext.sol";
import {CompatibilityFallbackHandler} from "@safe-global/safe-contracts/contracts/handler/CompatibilityFallbackHandler.sol";
import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
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
 */
contract Safe4337Module is IAccount, HandlerContext, CompatibilityFallbackHandler {
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    /**
     * @notice The keccak256 hash of the EIP-712 SafeOp struct, representing the structure of a User Operation for Safe.
     *  {address} safe - The address of the safe on which the operation is performed.
     *  {bytes} callData - The bytes representing the data of the function call to be executed.
     *  {uint256} nonce - A unique number associated with the user operation, preventing replay attacks by ensuring each operation is unique.
     *  {uint256} preVerificationGas - The amount of gas allocated for pre-verification steps before executing the main operation.
     *  {uint256} verificationGasLimit - The maximum amount of gas allowed for the verification process.
     *  {uint256} callGasLimit - The maximum amount of gas allowed for executing the function call.
     *  {uint256} maxFeePerGas - The maximum fee per gas that the user is willing to pay for the transaction.
     *  {uint256} maxPriorityFeePerGas - The maximum priority fee per gas that the user is willing to pay for the transaction.
     *  {uint48} validAfter - A timestamp representing from when the user operation is valid.
     *  {uint48} validUntil - A timestamp representing until when the user operation is valid, or 0 to indicated "forever".
     *  {address} entryPoint - The address of the entry point that will execute the user operation.
     * @dev When validating the user operation, the signature timestamps are pre-pended to the signature bytes.
     */
    bytes32 private constant SAFE_OP_TYPEHASH =
        keccak256(
            "SafeOp(address safe,bytes callData,uint256 nonce,uint256 preVerificationGas,uint256 verificationGasLimit,uint256 callGasLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint48 validAfter,uint48 validUntil,address entryPoint)"
        );

    address public immutable SUPPORTED_ENTRYPOINT;

    constructor(address entryPoint) {
        require(entryPoint != address(0), "Invalid entry point");
        SUPPORTED_ENTRYPOINT = entryPoint;
    }

    /**
     * @notice Validates the call is initiated by the entry point.
     */
    modifier onlySupportedEntryPoint() {
        require(_msgSender() == SUPPORTED_ENTRYPOINT, "Unsupported entry point");
        _;
    }

    /**
     * @notice Validates a user operation provided by the entry point.
     * @inheritdoc IAccount
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 missingAccountFunds
    ) external onlySupportedEntryPoint returns (uint256 validationData) {
        address payable safeAddress = payable(userOp.sender);
        // The entry point address is appended to the calldata in `HandlerContext` contract
        // Because of this, the relayer may manipulate the entry point address, therefore we have to verify that
        // the sender is the Safe specified in the userOperation
        require(safeAddress == msg.sender, "Invalid caller");

        // We check the execution function signature to make sure the entry point can't call any other function
        // and make sure the execution of the user operation is handled by the module
        require(
            this.executeUserOp.selector == bytes4(userOp.callData) || this.executeUserOpWithErrorString.selector == bytes4(userOp.callData),
            "Unsupported execution function id"
        );

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
        require(ISafe(msg.sender).execTransactionFromModule(to, value, data, operation), "Execution failed");
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
     * @return The EIP-712 domain separator hash for this contract.
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, this));
    }

    /**
     * @dev Returns the bytes to be hashed and signed by owners.
     * @param safe Safe address.
     * @param callData Call data.
     * @param nonce Nonce of the operation.
     * @param preVerificationGas Gas required for pre-verification (e.g. for EOA signature verification).
     * @param verificationGasLimit Gas required for verification.
     * @param callGasLimit Gas available during the execution of the call.
     * @param maxFeePerGas Max fee per gas.
     * @param maxPriorityFeePerGas Max priority fee per gas.
     * @param validAfter The timestamp the operation is valid from.
     * @param validUntil The timestamp the operation is valid until.
     * @return Operation bytes.
     */
    function getOperationData(
        address safe,
        bytes memory callData,
        uint256 nonce,
        uint256 preVerificationGas,
        uint256 verificationGasLimit,
        uint256 callGasLimit,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint48 validAfter,
        uint48 validUntil
    ) internal view returns (bytes memory) {
        bytes32 safeOperationHash = keccak256(
            abi.encode(
                SAFE_OP_TYPEHASH,
                safe,
                keccak256(callData),
                nonce,
                preVerificationGas,
                verificationGasLimit,
                callGasLimit,
                maxFeePerGas,
                maxPriorityFeePerGas,
                validAfter,
                validUntil,
                SUPPORTED_ENTRYPOINT
            )
        );
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), safeOperationHash);
    }

    /**
     * @dev Returns the 32-byte Safe operation hash to be signed by owners.
     * @param safe Safe address.
     * @param callData Call data.
     * @param nonce Nonce of the operation.
     * @param preVerificationGas Gas required for pre-verification (e.g. for EOA signature verification).
     * @param verificationGasLimit Gas required for verification.
     * @param callGasLimit Gas available during the execution of the call.
     * @param maxFeePerGas Max fee per gas.
     * @param maxPriorityFeePerGas Max priority fee per gas.
     * @param validAfter The timestamp the operation is valid from.
     * @param validUntil The timestamp the operation is valid until.
     * @return Operation hash.
     */
    function getOperationHash(
        address safe,
        bytes memory callData,
        uint256 nonce,
        uint256 preVerificationGas,
        uint256 verificationGasLimit,
        uint256 callGasLimit,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint48 validAfter,
        uint48 validUntil
    ) external view returns (bytes32) {
        return
            keccak256(
                getOperationData(
                    safe,
                    callData,
                    nonce,
                    preVerificationGas,
                    verificationGasLimit,
                    callGasLimit,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                    validAfter,
                    validUntil
                )
            );
    }

    /**
     * @dev Validates that the user operation is correctly signed. Reverts if signatures are invalid.
     * @param userOp User operation struct.
     * @return validationData An integer indicating the result of the validation.
     */
    function _validateSignatures(UserOperation calldata userOp) internal view returns (uint256 validationData) {
        (uint48 validAfter, uint48 validUntil, bytes calldata signature) = _splitSignatureData(userOp.signature);
        bytes memory operationData = getOperationData(
            payable(userOp.sender),
            userOp.callData,
            userOp.nonce,
            userOp.preVerificationGas,
            userOp.verificationGasLimit,
            userOp.callGasLimit,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            validAfter,
            validUntil
        );
        bytes32 operationHash = keccak256(operationData);

        try ISafe(payable(userOp.sender)).checkSignatures(operationHash, operationData, signature) {
            // The timestamps are validated by the entry point, therefore we will not check them again
            validationData = _packValidationData(false, validUntil, validAfter);
        } catch {
            validationData = _packValidationData(true, validUntil, validAfter);
        }
    }

    /**
     * @dev Splits the user operation signature bytes into its parts.
     * @param signatureData The user operation signature.
     * @return validAfter The timestamp the user operation is valid from.
     * @return validUntil The timestamp the user operation is valid until.
     * @return signature The actual signature for the Safe user operation.
     */
    function _splitSignatureData(
        bytes calldata signatureData
    ) internal pure returns (uint48 validAfter, uint48 validUntil, bytes calldata signature) {
        validAfter = uint48(bytes6(signatureData[0:6]));
        validUntil = uint48(bytes6(signatureData[6:12]));
        signature = signatureData[12:];
    }
}
