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
     *  {uint96} signatureTimestamps - A 96-bit value representing two 48-bit timestamps: validUntil and validAfter (in that order).
     *  {address} entryPoint - The address of the entry point that will execute the user operation.
     * @dev When validating the user operation, the signature timestamps are pre-pended to the signature bytes.
     */
    bytes32 private constant SAFE_OP_TYPEHASH =
        keccak256(
            "SafeOp(address safe,bytes callData,uint256 nonce,uint256 preVerificationGas,uint256 verificationGasLimit,uint256 callGasLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint96 signatureTimestamps,address entryPoint)"
        );

    address public immutable SUPPORTED_ENTRYPOINT;

    constructor(address entryPoint) {
        require(entryPoint != address(0), "Invalid entry point");
        SUPPORTED_ENTRYPOINT = entryPoint;
    }

    /**
     * @notice Validates a user operation provided by the entry point.
     * @inheritdoc IAccount
     */
    function validateUserOp(UserOperation calldata userOp, bytes32, uint256 missingAccountFunds) external returns (uint256 validationData) {
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

        address entryPoint = _msgSender();
        require(entryPoint == SUPPORTED_ENTRYPOINT, "Unsupported entry point");

        // The userOp nonce is validated in the entry point (for 0.6.0+), therefore we will not check it again
        validationData = _validateSignatures(entryPoint, userOp);

        // We trust the entry point to set the correct prefund value, based on the operation params
        // We need to perform this even if the signature is not valid, else the simulation function of the entry point will not work.
        if (missingAccountFunds != 0) {
            // We intentionally ignore errors in paying the missing account funds, as the entry point is responsible for
            // verifying the prefund has been paid. This behaviour matches the reference base account implementation.
            ISafe(safeAddress).execTransactionFromModule(entryPoint, missingAccountFunds, "", 0);
        }
    }

    /**
     * @notice Executes a user operation provided by the entry point.
     * @param to Destination address of the user operation.
     * @param value Ether value of the user operation.
     * @param data Data payload of the user operation.
     * @param operation Operation type of the user operation.
     */
    function executeUserOp(address to, uint256 value, bytes calldata data, uint8 operation) external {
        address entryPoint = _msgSender();
        require(entryPoint == SUPPORTED_ENTRYPOINT, "Unsupported entry point");

        require(ISafe(msg.sender).execTransactionFromModule(to, value, data, operation), "Execution failed");
    }

    /**
     * @notice Executes a user operation provided by the entry point and returns error message on failure.
     * @param to Destination address of the user operation.
     * @param value Ether value of the user operation.
     * @param data Data payload of the user operation.
     * @param operation Operation type of the user operation.
     */
    function executeUserOpWithErrorString(address to, uint256 value, bytes calldata data, uint8 operation) external {
        address entryPoint = _msgSender();
        require(entryPoint == SUPPORTED_ENTRYPOINT, "Unsupported entry point");

        (bool success, bytes memory returnData) = ISafe(msg.sender).execTransactionFromModuleReturnData(to, value, data, operation);
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly ("memory-safe") {
                revert(add(returnData, 0x20), returnData)
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
     * @dev Returns the bytes that are hashed to be signed by owners.
     * @param safe Safe address.
     * @param callData Call data.
     * @param nonce Nonce of the operation.
     * @param preVerificationGas Gas required for pre-verification (e.g. for EOA signature verification).
     * @param verificationGasLimit Gas required for verification.
     * @param callGasLimit Gas available during the execution of the call.
     * @param maxFeePerGas Max fee per gas.
     * @param maxPriorityFeePerGas Max priority fee per gas.
     * @param entryPoint Address of the entry point.
     * @return Operation hash bytes.
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
        uint96 signatureTimestamps,
        address entryPoint
    ) public view returns (bytes32) {
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
                signatureTimestamps,
                entryPoint
            )
        );
        return keccak256(abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), safeOperationHash));
    }

    /**
     * @dev Validates that the user operation is correctly signed. Reverts if signatures are invalid.
     * @param entryPoint Address of the entry point.
     * @param userOp User operation struct.
     * @return validationData An integer indicating the result of the validation.
     */
    function _validateSignatures(address entryPoint, UserOperation calldata userOp) internal view returns (uint256 validationData) {
        uint96 signatureTimestamps = uint96(bytes12(userOp.signature[:12]));
        bytes32 operationHash = getOperationHash(
            payable(userOp.sender),
            userOp.callData,
            userOp.nonce,
            userOp.preVerificationGas,
            userOp.verificationGasLimit,
            userOp.callGasLimit,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            signatureTimestamps,
            entryPoint
        );

        // The timestamps are validated by the entry point, therefore we will not check them again
        uint48 validUntil = uint48(signatureTimestamps >> 48);
        uint48 validAfter = uint48(signatureTimestamps);
        try ISafe(payable(userOp.sender)).checkSignatures(operationHash, "", userOp.signature[12:]) {
            validationData = _packValidationData(false, validUntil, validAfter);
        } catch {
            validationData = _packValidationData(true, validUntil, validAfter);
        }
    }
}
