// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {UserOperation, UserOperationLib} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";

contract SafeMock {
    address public immutable SUPPORTED_ENTRYPOINT;

    address public singleton;
    address public owner;
    address public fallbackHandler;
    mapping(address => bool) public modules;

    constructor(address entryPoint) {
        owner = msg.sender;
        SUPPORTED_ENTRYPOINT = entryPoint;
    }

    function setup(address _fallbackHandler, address _module) public virtual {
        require(owner == address(0), "Already setup");
        owner = msg.sender;
        fallbackHandler = _fallbackHandler;
        modules[_module] = true;
        modules[SUPPORTED_ENTRYPOINT] = true;
    }

    function _signatureSplit(bytes memory signature) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
    }

    function checkSignatures(bytes32 dataHash, bytes memory data, bytes memory signature) public view {
        require(dataHash == keccak256(data), "Invalid data hash");
        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = _signatureSplit(signature);
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

contract Safe4337Mock is SafeMock, IAccount {
    using UserOperationLib for UserOperation;
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    bytes32 private constant SAFE_OP_TYPEHASH =
        keccak256(
            "SafeOp(address safe,uint256 nonce,bytes initCode,bytes callData,uint256 callGasLimit,uint256 verificationGasLimit,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,bytes paymasterAndData,uint48 validAfter,uint48 validUntil,address entryPoint)"
        );

    constructor(address entryPoint) SafeMock(entryPoint) {}

    /**
     * @notice Validates the call is initiated by the entry point.
     */
    modifier onlySupportedEntryPoint() {
        require(msg.sender == SUPPORTED_ENTRYPOINT, "Unsupported entry point");
        _;
    }

    /// @dev Validates user operation provided by the entry point
    /// @inheritdoc IAccount
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 missingAccountFunds
    ) external onlySupportedEntryPoint returns (uint256 validationData) {
        // We check the execution function signature to make sure the entryPoint can't call any other function
        // and make sure the execution of the user operation is handled by the module
        require(
            this.executeUserOp.selector == bytes4(userOp.callData) || this.executeUserOpWithErrorString.selector == bytes4(userOp.callData),
            "Unsupported execution function id"
        );

        validationData = _validateSignatures(userOp);

        if (missingAccountFunds != 0) {
            (bool success, ) = SUPPORTED_ENTRYPOINT.call{value: missingAccountFunds}("");
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
    function executeUserOp(address to, uint256 value, bytes memory data, uint8 operation) external onlySupportedEntryPoint {
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
    function executeUserOpWithErrorString(address to, uint256 value, bytes memory data, uint8 operation) external onlySupportedEntryPoint {
        bool success;
        bytes memory returnData;
        if (operation == 1) (success, returnData) = to.delegatecall(data);
        else (success, returnData) = to.call{value: value}(data);
        require(success, string(returnData));
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, this));
    }

    function chainId() public view returns (uint256) {
        return block.chainid;
    }

    /// @dev Validates that the user operation is correctly signed. Users methods from Safe contract, reverts if signatures are invalid
    /// @param userOp User operation struct
    function _validateSignatures(UserOperation calldata userOp) internal view returns (uint256 validationData) {
        (bytes memory operationData, uint48 validAfter, uint48 validUntil, bytes calldata signatures) = _getSafeOp(userOp);
        bytes32 operationHash = keccak256(operationData);

        checkSignatures(operationHash, operationData, signatures);
        validationData = _packValidationData(false, validUntil, validAfter);
    }

    function _getSafeOp(
        UserOperation calldata userOp
    ) internal view returns (bytes memory operationData, uint48 validAfter, uint48 validUntil, bytes calldata signatures) {
        {
            bytes calldata sig = userOp.signature;
            validAfter = uint48(bytes6(sig[0:6]));
            validUntil = uint48(bytes6(sig[6:12]));
            signatures = sig[12:];
        }

        {
            UserOperation calldata _userOp = userOp;
            uint256 _validAfter;
            uint256 _validUntil;

            operationData = abi.encodePacked(
                bytes1(0x19),
                bytes1(0x01),
                domainSeparator(),
                keccak256(
                    abi.encode(
                        SAFE_OP_TYPEHASH,
                        _userOp.sender,
                        _userOp.nonce,
                        keccak256(_userOp.initCode),
                        keccak256(_userOp.callData),
                        _userOp.callGasLimit,
                        _userOp.verificationGasLimit,
                        _userOp.preVerificationGas,
                        _userOp.maxFeePerGas,
                        _userOp.maxPriorityFeePerGas,
                        keccak256(_userOp.paymasterAndData),
                        _validAfter,
                        _validUntil,
                        SUPPORTED_ENTRYPOINT
                    )
                )
            );
        }
    }
}
