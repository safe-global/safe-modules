// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {HandlerContext} from "@safe-global/safe-contracts/contracts/handler/HandlerContext.sol";
import {CompatibilityFallbackHandler} from "@safe-global/safe-contracts/contracts/handler/CompatibilityFallbackHandler.sol";
import {IAccount, INonceManager, UserOperation} from "./interfaces/ERC4337.sol";
import {ISafe} from "./interfaces/Safe.sol";

/// @title EIP4337Module
contract Simple4337Module is IAccount, HandlerContext, CompatibilityFallbackHandler {
    // value in case of signature failure, with no time-range.
    // equivalent to _packValidationData(true,0,0);
    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    bytes32 private constant SAFE_OP_TYPEHASH =
        keccak256(
            "SafeOp(address safe,bytes callData,uint256 nonce,uint256 preVerificationGas,uint256 verificationGasLimit,uint256 callGasLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,address entryPoint)"
        );

    address public immutable supportedEntryPoint;

    constructor(address entryPoint) {
        supportedEntryPoint = entryPoint;
    }

    /// @dev Validates user operation provided by the entry point
    /// @param userOp User operation struct
    /// @param requiredPrefund Required prefund to execute the operation
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 requiredPrefund
    ) external returns (uint256 validationResult) {
        address payable safeAddress = payable(userOp.sender);
        // The entryPoint address is appended to the calldata in `HandlerContext` contract
        // Because of this, the relayer may manipulate the entryPoint address, therefore we have to verify that
        // the sender is the Safe specified in the userOperation
        require(safeAddress == msg.sender, "Invalid Caller");

        // We check the execution function signature to make sure the entryPoint can't call any other function
        // and make sure the execution of the user operation is handled by the module
        require(
            this.executeUserOp.selector == bytes4(userOp.callData) || this.executeUserOpWithErrorString.selector == bytes4(userOp.callData),
            "Unsupported execution function id"
        );

        address entryPoint = _msgSender();
        require(entryPoint == supportedEntryPoint, "Unsupported entry point");

        // The userOp nonce is validated in the Entrypoint (for 0.6.0+), therefore we will not check it again
        validationResult = validateSignatures(entryPoint, userOp);

        // We trust the entrypoint to set the correct prefund value, based on the operation params
        // We need to perform this even if the signature is not valid, else the simulation function of the Entrypoint will not work
        if (requiredPrefund != 0) {
            ISafe(safeAddress).execTransactionFromModule(entryPoint, requiredPrefund, "", 0);
        }
    }

    /// @notice Executes user operation provided by the entry point
    /// @dev Reverts if unsuccessful
    /// @param to Destination address of the user operation.
    /// @param value Ether value of the user operation.
    /// @param data Data payload of the user operation.
    /// @param operation Operation type of the user operation.
    function executeUserOp(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external {
        address entryPoint = _msgSender();
        require(entryPoint == supportedEntryPoint, "Unsupported entry point");

        require(ISafe(msg.sender).execTransactionFromModule(to, value, data, operation), "Execution failed");
    }

    /// @notice Executes user operation provided by the entry point
    /// @dev Reverts if unsuccessful and bubbles up the error message
    /// @param to Destination address of the user operation.
    /// @param value Ether value of the user operation.
    /// @param data Data payload of the user operation.
    /// @param operation Operation type of the user operation.
    function executeUserOpWithErrorString(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external {
        address entryPoint = _msgSender();
        require(entryPoint == supportedEntryPoint, "Unsupported entry point");

        (bool success, bytes memory returnData) = ISafe(msg.sender).execTransactionFromModuleReturnData(to, value, data, operation);
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                revert(add(returnData, 0x20), returnData)
            }
        }
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, this));
    }

    /// @dev Returns the bytes that are hashed to be signed by owners.
    /// @param safe Safe address
    /// @param callData Call data
    /// @param nonce Nonce of the operation
    /// @param preVerificationGas Gas required for pre-verification (e.g. for EOA signature verification)
    /// @param verificationGasLimit Gas required for verification
    /// @param callGasLimit Gas available during the execution of the call
    /// @param maxFeePerGas Max fee per gas
    /// @param maxPriorityFeePerGas Max priority fee per gas
    /// @param entryPoint Address of the entry point
    /// @return Operation hash bytes
    function getOperationHash(
        address safe,
        bytes calldata callData,
        uint256 nonce,
        uint256 preVerificationGas,
        uint256 verificationGasLimit,
        uint256 callGasLimit,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
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
                entryPoint
            )
        );
        return keccak256(abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), safeOperationHash));
    }

    /// @dev Validates that the user operation is correctly signed. Users methods from Safe contract, reverts if signatures are invalid
    /// @param entryPoint Address of the entry point
    /// @param userOp User operation struct
    function validateSignatures(address entryPoint, UserOperation calldata userOp) internal view returns (uint256) {
        bytes32 operationHash = getOperationHash(
            payable(userOp.sender),
            userOp.callData,
            userOp.nonce,
            userOp.preVerificationGas,
            userOp.verificationGasLimit,
            userOp.callGasLimit,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            entryPoint
        );

        try ISafe(payable(userOp.sender)).checkSignatures(operationHash, "", userOp.signature) {
            return 0;
        } catch {
            return SIG_VALIDATION_FAILED;
        }
    }
}
