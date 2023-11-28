// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
import {SafeStorage} from "@safe-global/safe-contracts/contracts/libraries/SafeStorage.sol";
import {ISafe} from "./interfaces/Safe.sol";

/**
 * @title SafeLaunchpad - A contract for complex Safe initialization to enable setups that would violate ERC-4337 factory rules.
 * @dev The is intended to be set as a Safe proxy's implementation for ERC-4337 user operation that deploys the account.
 */
contract SafeLaunchpad is IAccount, SafeStorage {
    // keccak256("SafeLaunchpad.initHash") - 1
    uint256 private constant INIT_HASH_SLOT = 0xfe39743d5545ae15debabf80f9f105bde089b80c1c186c0fa4eb78349b870a8b;

    /**
     * @notice The keccak256 hash of the EIP-712 SafeInit struct, representing the structure of a ERC-4337 compatible Safe initialization.
     *  {address} singleton - The singleton to evolve into during the setup.
     *  {bytes} initializer - The setup initializer bytes.
     *  {uint256} nonce - A unique number associated with the user operation, preventing replay attacks by ensuring each operation is unique.
     *  {uint256} preVerificationGas - The amount of gas allocated for pre-verification steps before executing the main operation.
     *  {uint256} verificationGasLimit - The maximum amount of gas allowed for the verification process.
     *  {uint256} callGasLimit - The maximum amount of gas allowed for executing the function call.
     *  {uint256} maxFeePerGas - The maximum fee per gas that the user is willing to pay for the transaction.
     *  {uint256} maxPriorityFeePerGas - The maximum priority fee per gas that the user is willing to pay for the transaction.
     *  {uint48} validAfter - A timestamp representing from when the setup user operation is valid.
     *  {uint48} validUntil - A timestamp representing until when the setup user operation is valid, or 0 to indicated "forever".
     *  {address} entryPoint - The address of the entry point that will execute the user operation.
     */
    bytes32 private constant SAFE_INIT_TYPEHASH =
        keccak256(
            "SafeInit(address singleton,bytes initializer,uint256 nonce,uint256 preVerificationGas,uint256 verificationGasLimit,uint256 callGasLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint48 validAfter,uint48 validUntil,address entryPoint)"
        );

    /**
     * @notice The keccak256 hash of the EIP-712 SafeInitOp struct, representing an ERC-4337 user operation with initialization.
     *  {SafeInit} init - The initialization parameters.
     *  {bytes} callData - The post-initialization call data to self.
     */
    bytes32 private constant SAFE_INIT_OP_TYPEHASH =
        keccak256(
            "SafeInitOp(SafeInit init,bytes callData)SafeInit(address singleton,bytes initializer,uint256 nonce,uint256 preVerificationGas,uint256 verificationGasLimit,uint256 callGasLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint48 validAfter,uint48 validUntil,address entryPoint)"
        );

    address private immutable SELF;
    address public immutable SUPPORTED_ENTRYPOINT;

    constructor(address entryPoint) {
        require(entryPoint != address(0), "Invalid entry point");

        SELF = address(this);
        SUPPORTED_ENTRYPOINT = entryPoint;
    }

    modifier onlyProxy() {
        require(singleton == SELF, "Not called from proxy");
        _;
    }

    modifier onlySupportedEntryPoint() {
        require(msg.sender == SUPPORTED_ENTRYPOINT, "Unsupported entry point");
        _;
    }

    function setup(bytes32 initHash, address to, bytes calldata preInit) external onlyProxy {
        _setInitHash(initHash);
        if (to != address(0)) {
            (bool success, ) = to.delegatecall(preInit);
            require(success, "Pre-initialization failed");
        }
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 missingAccountFunds
    ) external override onlyProxy onlySupportedEntryPoint returns (uint256 validationData) {
        bytes4 selector = bytes4(userOp.callData[:4]);
        require(selector == this.initializeThenUserOp.selector, "Invalid user op calldata");

        (uint48 validAfter, uint48 validUntil) = _splitUserOpSignatureData(userOp.signature);
        (address singleton, bytes memory initializer) = abi.decode(userOp.callData, (address, bytes));
        bytes32 initHash = _computeInitHash(
            singleton,
            initializer,
            userOp.nonce,
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            validAfter,
            validUntil
        );

        if (_initHash() == initHash) {
            validationData = _packValidationData(false, validUntil, validAfter);
        } else {
            validationData = _packValidationData(true, validUntil, validAfter);
        }

        if (missingAccountFunds > 0) {
            assembly ("memory-safe") {
                pop(call(gas(), caller(), missingAccountFunds, 0, 0, 0, 0))
            }
        }
    }

    function initializeThenUserOp(
        address singleton,
        bytes calldata initializer,
        bytes calldata callData,
        bytes calldata signature
    ) external onlySupportedEntryPoint {
        SafeStorage.singleton = singleton;
        {
            (bool success, ) = address(this).call(initializer);
            require(success);
        }

        ISafe safe = ISafe(payable(address(this)));
        bytes memory operationData = _computeInitOpData(safe, callData);
        bytes32 operationHash = keccak256(operationData);

        try safe.checkSignatures(operationHash, operationData, signature) {
            (bool success, bytes memory returnData) = address(this).delegatecall(callData);
            if (!success) {
                assembly ("memory-safe") {
                    revert(add(returnData, 0x20), mload(returnData))
                }
            }
        } catch {
            // do not revert, maybe emit an event?
        }
    }

    function _computeInitHash(
        address singleton,
        bytes memory initializer,
        uint256 nonce,
        uint256 callGasLimit,
        uint256 verificationGasLimit,
        uint256 preVerificationGas,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint48 validAfter,
        uint48 validUntil
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    SAFE_INIT_OP_TYPEHASH,
                    singleton,
                    keccak256(initializer),
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
    }

    function _computeInitOpData(ISafe safe, bytes memory callData) public view returns (bytes memory) {
        bytes32 safeOperationHash = keccak256(abi.encode(SAFE_INIT_OP_TYPEHASH, _initHash(), keccak256(callData)));
        bytes32 domainSeparator = safe.domainSeparator();
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator, safeOperationHash);
    }

    function _splitUserOpSignatureData(bytes calldata signatureData) internal pure returns (uint48 validAfter, uint48 validUntil) {
        require(signatureData.length == 12, "Invalid signature data");
        validAfter = uint48(bytes6(signatureData[:6]));
        validUntil = uint48(bytes6(signatureData[6:]));
    }

    function _initHash() public view returns (bytes32 value) {
        assembly ("memory-safe") {
            value := sload(INIT_HASH_SLOT)
        }
    }

    function _setInitHash(bytes32 value) internal {
        assembly ("memory-safe") {
            sstore(INIT_HASH_SLOT, value)
        }
    }

    function _isContract(address account) internal view returns (bool) {
        uint256 size;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            size := extcodesize(account)
        }
        /* solhint-enable no-inline-assembly */
        return size > 0;
    }
}
