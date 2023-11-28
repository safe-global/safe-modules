// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
import {SafeStorage} from "@safe-global/safe-contracts/contracts/libraries/SafeStorage.sol";
import {GasLimits, GasLimitsLib} from "./libraries/GasLimits.sol";

/**
 * @title SafeLaunchpad - A contract for complex Safe initialization to enable setups that would violate ERC-4337 factory rules.
 * @dev The is intended to be set as a Safe proxy's implementation for ERC-4337 user operation that deploys the account.
 */
contract SafeLaunchpad is IAccount, SafeStorage {
    // keccak256("SafeLaunchpad.initHash") - 1
    uint256 private constant INIT_HASH_SLOT = 0xfe39743d5545ae15debabf80f9f105bde089b80c1c186c0fa4eb78349b870a8b;
    // keccak256("SafeLaunchpad.gasLimits") - 1
    uint256 private constant GAS_LIMITS_SLOT = 0x1c817998d44a609b8f7e6008d00937638585441575d8c7f3e50c30ced4d6b9bf;

    address public immutable SUPPORTED_ENTRYPOINT;

    constructor(address entryPoint) {
        require(entryPoint != address(0), "Invalid entry point");
        SUPPORTED_ENTRYPOINT = entryPoint;
    }

    modifier onlyProxy() {
        require(singleton != address(0), "Not called from proxy");
        _;
    }

    modifier onlySupportedEntryPoint() {
        require(msg.sender == SUPPORTED_ENTRYPOINT, "Unsupported entry point");
        _;
    }

    function setup(bytes32 initHash, GasLimits limits) external onlyProxy {
        _setInitHash(initHash);
        _setGasLimits(limits);
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 missingAccountFunds
    ) external override onlySupportedEntryPoint returns (uint256 validationData) {
        // @param nonce
        require(userOp.nonce == 0, "Nonce must be 0");
        require(userOp.signature.length == 0, "Invalid user op signature");

        // Here we need to validate the initialization matches the expected value
        // **Prefunding is validation**
        // @param callData
        bytes4 selector = bytes4(userOp.callData[:4]);
        require(selector == this.initializationUserOp.selector, "Invalid user op calldata");

        // @param callData
        (address singleton, bytes memory initializer, ) = abi.decode(userOp.callData, (address, bytes, bytes));
        require(_initHash() == _computeInitHash(singleton, initializer), "Invalid initializer");

        /**
         * @param callGasLimit the gas limit passed to the callData method call.
         * @param verificationGasLimit gas used for validateUserOp and validatePaymasterUserOp.
         * @param preVerificationGas gas not calculated by the handleOps method, but added to the gas paid. Covers batch overhead.
         * @param maxFeePerGas same as EIP-1559 gas parameter.
         * @param maxPriorityFeePerGas same as EIP-1559 gas parameter.
         * @param paymasterAndData if set, this field holds the paymaster address and paymaster-specific data. the paymaster will pay for the transaction instead of the sender.
         */
        require(_gasLimits().matches(userOp), "Invalid gas limits");

        validationData = 0;
        if (missingAccountFunds > 0) {
            assembly ("memory-safe") {
                pop(call(gas(), caller(), missingAccountFunds, 0, 0, 0, 0))
            }
        }
    }

    function initializationUserOp(
        address singleton,
        bytes calldata initializer,
        bytes calldata signature
    ) external onlySupportedEntryPoint {
        // Here we need to actually check the actual signatures
        // TODO(nlordell): @param signature
    }

    function _computeInitHash(address singleton, bytes memory initializer) public pure returns (bytes32) {
        return keccak256(abi.encode(singleton, keccak256(initializer)));
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
