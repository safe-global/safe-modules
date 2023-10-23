// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "@safe-global/safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import "@safe-global/safe-contracts/contracts/SafeL2.sol";

import {INonceManager, UserOperation} from "../interfaces/ERC4337.sol";
import {UserOperationLib} from "./UserOperationLib.sol";

contract SafeMock {
    address public immutable supportedEntryPoint;

    address public singleton;
    address public owner;
    address public fallbackHandler;
    mapping(address => bool) public modules;

    constructor(address entryPoint) {
        owner = msg.sender;
        supportedEntryPoint = entryPoint;
    }

    function setup(address _fallbackHandler, address _module) public virtual {
        require(owner == address(0), "Already setup");
        owner = msg.sender;
        fallbackHandler = _fallbackHandler;
        modules[_module] = true;
        modules[supportedEntryPoint] = true;
    }

    function signatureSplit(bytes memory signature)
        internal
        pure
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
    }

    function checkSignatures(
        bytes32 dataHash,
        bytes memory,
        bytes memory signature
    ) public view {
        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = signatureSplit(signature);
        require(
            owner == ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash)), v, r, s),
            "Invalid signature"
        );
    }

    function execTransactionFromModule(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success) {
        require(modules[msg.sender], "not executing that");

        if (operation == 1) (success, ) = to.delegatecall(data);
        else (success, ) = to.call{value: value}(data);
    }

    function execTransactionFromModuleReturnData(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success, bytes memory returnData) {
        require(modules[msg.sender], "not executing that");

        if (operation == 1) (success, returnData) = to.delegatecall(data);
        else (success, returnData) = to.call{value: value}(data);
    }

    /**
     * @dev Reads `length` bytes of storage in the currents contract
     * @param offset - the offset in the current contract's storage in words to start reading from
     * @param length - the number of words (32 bytes) of data to read
     * @return the bytes that were read.
     */
    function getStorageAt(uint256 offset, uint256 length) public view returns (bytes memory) {
        bytes memory result = new bytes(length * 32);
        for (uint256 index = 0; index < length; index++) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let word := sload(add(offset, index))
                mstore(add(add(result, 0x20), mul(index, 0x20)), word)
            }
        }
        return result;
    }

    // solhint-disable-next-line payable-fallback,no-complex-fallback
    fallback() external payable {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let handler := sload(fallbackHandler.slot)
            if iszero(handler) {
                return(0, 0)
            }
            calldatacopy(0, 0, calldatasize())
            // The msg.sender address is shifted to the left by 12 bytes to remove the padding
            // Then the address without padding is stored right after the calldata
            mstore(calldatasize(), shl(96, caller()))
            // Add 20 bytes for the address appended add the end
            let success := call(gas(), handler, 0, 0, add(calldatasize(), 20), 0, 0)
            returndatacopy(0, 0, returndatasize())
            if iszero(success) {
                revert(0, returndatasize())
            }
            return(0, returndatasize())
        }
    }

    receive() external payable {}
}

contract Safe4337Mock is SafeMock {
    using UserOperationLib for UserOperation;
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    bytes32 private constant SAFE_OP_TYPEHASH =
        keccak256(
            "SafeOp(address safe,bytes callData,uint256 nonce,uint256 preVerificationGas,uint256 verificationGasLimit,uint256 callGasLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,address entryPoint)"
        );

    constructor(address entryPoint) SafeMock(entryPoint) {}

    /// @dev Validates user operation provided by the entry point
    /// @param userOp User operation struct
    /// @param requiredPrefund Required prefund to execute the operation
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 requiredPrefund
    ) external returns (uint256) {
        address entryPoint = msg.sender;
        require(entryPoint == supportedEntryPoint, "Unsupported entry point");

        validateReplayProtection(userOp);

        // We check the execution function signature to make sure the entryPoint can't call any other function
        // and make sure the execution of the user operation is handled by the module
        require(
            this.executeUserOp.selector == bytes4(userOp.callData) || this.executeUserOpWithErrorString.selector == bytes4(userOp.callData),
            "Unsupported execution function id"
        );

        // We need to make sure that the entryPoint's requested prefund is in bounds
        require(requiredPrefund <= userOp.requiredPreFund(), "Prefund too high");
        _validateSignatures(entryPoint, userOp);

        if (requiredPrefund != 0) {
            (bool success, ) = entryPoint.call{value: requiredPrefund}("");
            success;
        }
        return 0;
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
        address entryPoint = msg.sender;
        require(entryPoint == supportedEntryPoint, "Unsupported entry point");

        bool success;
        if (operation == 1) (success, ) = to.delegatecall(data);
        else (success, ) = to.call{value: value}(data);
        require(success, "Execution failed");
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
        address entryPoint = msg.sender;
        require(entryPoint == supportedEntryPoint, "Unsupported entry point");

        bool success;
        bytes memory returnData;
        if (operation == 1) (success, returnData) = to.delegatecall(data);
        else (success, returnData) = to.call{value: value}(data);
        require(success, string(returnData));
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
    function encodeOperationData(
        address safe,
        bytes calldata callData,
        uint256 nonce,
        uint256 preVerificationGas,
        uint256 verificationGasLimit,
        uint256 callGasLimit,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        address entryPoint
    ) public view returns (bytes memory) {
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

        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), safeOperationHash);
    }

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
        return
            keccak256(
                encodeOperationData(
                    safe,
                    callData,
                    nonce,
                    preVerificationGas,
                    verificationGasLimit,
                    callGasLimit,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                    entryPoint
                )
            );
    }

    function chainId() public view returns (uint256) {
        return block.chainid;
    }

    /// @dev Validates that the user operation is correctly signed. Users methods from Safe contract, reverts if signatures are invalid
    /// @param entryPoint Address of the entry point
    /// @param userOp User operation struct
    function _validateSignatures(address entryPoint, UserOperation calldata userOp) internal view {
        bytes memory operationData = encodeOperationData(
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
        bytes32 operationHash = keccak256(operationData);

        checkSignatures(operationHash, operationData, userOp.signature);
    }

    function validateReplayProtection(UserOperation calldata userOp) internal view {
        // The entrypoints handles the increase of the nonce
        // Right shifting fills up with 0s from the left
        uint192 key = uint192(userOp.nonce >> 64);
        uint256 safeNonce = INonceManager(supportedEntryPoint).getNonce(userOp.sender, key);

        // Check returned nonce against the user operation nonce
        require(safeNonce == userOp.nonce, "Invalid Nonce");
    }
}
