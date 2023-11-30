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
contract Safe4337Launchpad is IAccount, SafeStorage {
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    // keccak256("SafeLaunchpad.initHash") - 1
    uint256 private constant INIT_HASH_SLOT = 0xfe39743d5545ae15debabf80f9f105bde089b80c1c186c0fa4eb78349b870a8b;

    /**
     * @notice The keccak256 hash of the EIP-712 SafeInit struct, representing the structure of a ERC-4337 compatible Safe initialization.
     *  {address} singleton - The singleton to evolve into during the setup.
     *  {bytes} initializer - The setup initializer bytes.
     *  {uint256} nonce - A unique number associated with the user operation, preventing replay attacks by ensuring each operation is unique.
     *  {bytes24} initCodeFunction - The function pointer (i.e. factory address and 4-byte selector) used to create this Safe account.
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
     */
    bytes32 private constant SAFE_INIT_TYPEHASH =
        keccak256(
            "SafeInit(address singleton,bytes initializer,uint256 nonce,bytes24 initCodeFunction,bytes callData,uint256 callGasLimit,uint256 verificationGasLimit,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,bytes paymasterAndData,uint48 validAfter,uint48 validUntil,address entryPoint)"
        );

    struct EncodedSafeInitStruct {
        bytes32 typeHash;
        address singleton;
        bytes32 initializerHash;
        uint256 nonce;
        bytes24 initCodeFunction;
        bytes32 callDataHash;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes32 paymasterAndDataHash;
        uint48 validAfter;
        uint48 validUntil;
        address entryPoint;
    }

    /**
     * @notice The keccak256 hash of the EIP-712 SafeInitOp struct, representing an ERC-4337 user operation with initialization.
     *  {SafeInit} init - The initialization parameters.
     *  {address} safe - The address of the safe on which the operation is performed.
     *  {bytes} callData - The post-initialization call data to self.
     */
    bytes32 private constant SAFE_INIT_OP_TYPEHASH =
        keccak256(
            "SafeInitOp(SafeInit init,address safe,bytes callData)SafeInit(address singleton,bytes initializer,uint256 nonce,bytes24 initCodeFunction,bytes callData,uint256 callGasLimit,uint256 verificationGasLimit,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,bytes paymasterAndData,uint48 validAfter,uint48 validUntil,address entryPoint)"
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
        (bytes32 initHash, uint48 validAfter, uint48 validUntil) = _getSafeInit(userOp);
        if (_initHash() == initHash) {
            validationData = _packValidationData(false, validUntil, validAfter);
        } else {
            validationData = _packValidationData(true, validUntil, validAfter);
        }

        if (missingAccountFunds > 0) {
            // solhint-disable-next-line no-inline-assembly
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

        bytes memory operationData = _getSafeInitOpData(callData);
        try ISafe(payable(address(this))).checkSignatures(keccak256(operationData), operationData, signature) {
            (bool success, bytes memory returnData) = address(this).delegatecall(callData);
            if (!success) {
                // solhint-disable-next-line no-inline-assembly
                assembly ("memory-safe") {
                    revert(add(returnData, 0x20), mload(returnData))
                }
            }
        } catch {
            // do not revert, maybe emit an event?
        }

        _setInitHash(0);
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, SELF));
    }

    function _getSafeInit(UserOperation calldata userOp) public view returns (bytes32 initHash, uint48 validAfter, uint48 validUntil) {
        {
            bytes calldata sig = userOp.signature;
            require(sig.length == 12, "Invalid user op signature");
            validAfter = uint48(bytes6(sig[:6]));
            validUntil = uint48(bytes6(sig[6:]));
        }

        address singleton;
        bytes32 initializerHash;
        {
            bytes calldata callData = userOp.callData;
            require(bytes4(callData[:4]) == this.initializeThenUserOp.selector, "Invalid user op calldata");

            bytes memory initializer;
            (singleton, initializer) = abi.decode(callData[4:], (address, bytes));
            initializerHash = keccak256(initializer);
            require(_isContract(singleton), "Invalid user op singleton");
        }

        EncodedSafeInitStruct memory encodedSafeInit = EncodedSafeInitStruct({
            typeHash: SAFE_INIT_TYPEHASH,
            singleton: singleton,
            initializerHash: initializerHash,
            nonce: userOp.nonce,
            initCodeFunction: bytes24(userOp.initCode[:24]),
            callDataHash: keccak256(userOp.callData),
            callGasLimit: userOp.callGasLimit,
            verificationGasLimit: userOp.verificationGasLimit,
            preVerificationGas: userOp.preVerificationGas,
            maxFeePerGas: userOp.maxFeePerGas,
            maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
            paymasterAndDataHash: keccak256(userOp.paymasterAndData),
            validAfter: validAfter,
            validUntil: validUntil,
            entryPoint: SUPPORTED_ENTRYPOINT
        });

        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            initHash := keccak256(encodedSafeInit, 480)
        }
    }

    function _getSafeInitOpData(bytes memory callData) public view returns (bytes memory) {
        bytes32 safeOperationHash = keccak256(abi.encode(SAFE_INIT_OP_TYPEHASH, _initHash(), this, keccak256(callData)));
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), _domainSeparator(), safeOperationHash);
    }

    function _initHash() public view returns (bytes32 value) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            value := sload(INIT_HASH_SLOT)
        }
    }

    function _setInitHash(bytes32 value) internal {
        // solhint-disable-next-line no-inline-assembly
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
