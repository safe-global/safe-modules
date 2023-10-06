// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {HandlerContext} from "@safe-global/safe-contracts/contracts/handler/HandlerContext.sol";
import {CompatibilityFallbackHandler} from "@safe-global/safe-contracts/contracts/handler/CompatibilityFallbackHandler.sol";
import {UserOperation, UserOperationLib} from "./UserOperation.sol";
import {INonceManager} from "./interfaces/ERC4337.sol";
import {ISafe} from "./interfaces/Safe.sol";

/// @title EIP4337Module
abstract contract EIP4337Module is HandlerContext, CompatibilityFallbackHandler {
    using UserOperationLib for UserOperation;
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    bytes32 private constant SAFE_OP_TYPEHASH =
        keccak256(
            "SafeOp(address safe,bytes callData,uint256 nonce,uint256 verificationGas,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 callGas,address entryPoint)"
        );

    address public immutable supportedEntryPoint;
    bytes4 public immutable expectedExecutionFunctionId;

    constructor(address entryPoint, bytes4 executionFunctionId) {
        supportedEntryPoint = entryPoint;
        expectedExecutionFunctionId = executionFunctionId;
    }

    /// @dev Validates user operation provided by the entry point
    /// @param userOp User operation struct
    /// @param requiredPrefund Required prefund to execute the operation
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 requiredPrefund
    ) external returns (uint256) {
        address payable safeAddress = payable(userOp.sender);
        // The entryPoint address is appended to the calldata in `HandlerContext` contract
        // Because of this, the relayer may be manipulate the entryPoint address, therefore we have to verify that
        // the sender is the Safe specified in the userOperation
        require(safeAddress == msg.sender, "Invalid Caller");

        validateReplayProtection(userOp);

        require(expectedExecutionFunctionId == bytes4(userOp.callData), "Unsupported execution function id");

        // We need to make sure that the entryPoint's requested prefund is in bounds
        require(requiredPrefund <= userOp.requiredPreFund(), "Prefund too high");

        address entryPoint = _msgSender();
        require(entryPoint == supportedEntryPoint, "Unsupported entry point");
        _validateSignatures(entryPoint, userOp);

        if (requiredPrefund != 0) {
            ISafe(safeAddress).execTransactionFromModule(entryPoint, requiredPrefund, "", 0);
        }
        return 0;
    }

    function validateReplayProtection(UserOperation calldata userOp) internal virtual;

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, this));
    }

    /// @dev Returns the bytes that are hashed to be signed by owners.
    /// @param safe Safe address
    /// @param callData Call data
    /// @param nonce Nonce of the operation
    /// @param verificationGas Gas required for verification
    /// @param preVerificationGas Gas required for pre-verification (e.g. for EOA signature verification)
    /// @param maxFeePerGas Max fee per gas
    /// @param maxPriorityFeePerGas Max priority fee per gas
    /// @param callGas Gas available during the execution of the call
    /// @param entryPoint Address of the entry point
    /// @return Operation hash bytes
    function encodeOperationData(
        address safe,
        bytes calldata callData,
        uint256 nonce,
        uint256 verificationGas,
        uint256 preVerificationGas,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 callGas,
        address entryPoint
    ) public view returns (bytes memory) {
        bytes32 safeOperationHash = keccak256(
            abi.encode(
                SAFE_OP_TYPEHASH,
                safe,
                keccak256(callData),
                nonce,
                verificationGas,
                preVerificationGas,
                maxFeePerGas,
                maxPriorityFeePerGas,
                callGas,
                entryPoint
            )
        );

        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), safeOperationHash);
    }

    function getOperationHash(
        address safe,
        bytes calldata callData,
        uint256 nonce,
        uint256 verificationGas,
        uint256 preVerificationGas,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 callGas,
        address entryPoint
    ) public view returns (bytes32) {
        return
            keccak256(
                encodeOperationData(
                    safe,
                    callData,
                    nonce,
                    verificationGas,
                    preVerificationGas,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                    callGas,
                    entryPoint
                )
            );
    }

    /// @dev Validates that the user operation is correctly signed. Users methods from Safe contract, reverts if signatures are invalid
    /// @param entryPoint Address of the entry point
    /// @param userOp User operation struct
    function _validateSignatures(address entryPoint, UserOperation calldata userOp) internal view {
        bytes32 operationHash = getOperationHash(
            payable(userOp.sender),
            userOp.callData,
            userOp.nonce,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            userOp.callGasLimit,
            entryPoint
        );

        ISafe(payable(userOp.sender)).checkSignatures(operationHash, "", userOp.signature);
    }
}

contract Simple4337Module is EIP4337Module {
    constructor(address entryPoint)
        EIP4337Module(entryPoint, bytes4(keccak256("execTransactionFromModule(address,uint256,bytes,uint8)")))
    {}

    function validateReplayProtection(UserOperation calldata userOp) internal override {
        // The entrypoints handles the increase of the nonce
        // Right shifting fills up with 0s from the left
        uint192 key = uint192(userOp.nonce >> 64);
        uint256 safeNonce = INonceManager(supportedEntryPoint).getNonce(userOp.sender, key);

        // Check returned nonce against the user operation nonce
        require(safeNonce == userOp.nonce, "Invalid Nonce");
    }
}
