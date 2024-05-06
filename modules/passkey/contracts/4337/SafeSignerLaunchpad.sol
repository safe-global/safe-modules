// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
import {SafeStorage} from "@safe-global/safe-contracts/contracts/libraries/SafeStorage.sol";

import {ISafeSignerFactory, P256} from "../interfaces/ISafeSignerFactory.sol";
import {ISafe} from "../interfaces/ISafe.sol";
import {ERC1271} from "../libraries/ERC1271.sol";

/**
 * @title Safe Launchpad for Custom ECDSA Signing Schemes.
 * @dev A launchpad account implementation that enables the creation of Safes that use custom ECDSA signing schemes that
 * require additional contract deployments over ERC-4337. Note that it is not safe to rely on this launchpad for
 * deploying Safes that has an initial threshold greater than 1. This is because the first user operation (which can
 * freely change the owner structure) will only ever require a single signature to execute, so effectively the initial
 * owner will always have ultimate control over the Safe during the first user operation and can undo any changes to the
 * `threshold` during the `setup` phase.
 * @custom:security-contact bounty@safe.global
 */
contract SafeSignerLaunchpad is IAccount, SafeStorage {
    /**
     * @notice The EIP-712 type-hash for the domain separator used for verifying Safe initialization signatures.
     * @custom:computed-as keccak256("EIP712Domain(uint256 chainId,address verifyingContract)")
     */
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = 0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218;

    /**
     * @notice The storage slot used for the target Safe singleton address to promote to.
     * @custom:computed-as keccak256("SafeSignerLaunchpad.targetSingleton") - 1
     * @dev This value is intentionally computed to be a hash -1 as a precaution to avoid any potential issues from
     * unintended hash collisions.
     */
    uint256 private constant TARGET_SINGLETON_SLOT = 0x610b07c5cf4b478e92ab041de73a412736c750f1bf07a613600b24b3a8bd597e;

    /**
     * @notice The keccak256 hash of the EIP-712 SafeInitOp struct, representing the user operation to execute alongside initialization.
     *  {bytes32} userOpHash - The user operation hash being executed.
     *  {uint48} validAfter - A timestamp representing from when the user operation is valid.
     *  {uint48} validUntil - A timestamp representing until when the user operation is valid, or 0 to indicated "forever".
     *  {address} entryPoint - The address of the entry point that will execute the user operation.
     * @custom:computed-as keccak256("SafeInitOp(bytes32 userOpHash,uint48 validAfter,uint48 validUntil,address entryPoint)")
     */
    bytes32 private constant SAFE_INIT_OP_TYPEHASH = 0x25838d3914a61e3531f21f12b8cd3110a5f9d478292d07dd197859a5c4eaacb2;

    /**
     * @notice An error indicating that the entry point used when deploying a new module instance is invalid.
     */
    error InvalidEntryPoint();

    /**
     * @notice An error indicating a `CALL` to a function that should only be `DELEGATECALL`-ed from an account proxy.
     */
    error NotProxied();

    /**
     * @notice An error indicating that the call validating or executing a user operation was not called by the
     * supported entry point contract.
     */
    error UnsupportedEntryPoint();

    /**
     * @notice An error indicating an attempt to setup an account that has already been initialized.
     */
    error AlreadyInitialized();

    /**
     * @notice An error indicating an attempt to execute a user operation on an account that has already been promoted
     * to a Safe singleton.
     */
    error AlreadyPromoted();

    /**
     * @notice An error indicating that the account was initialized with an invalid Safe singleton address.
     */
    error InvalidSingleton();

    /**
     * @notice An error indicating that the account was changed to use an invalid threshold value. Accounts initialized
     * with the Safe launchpad must be initialized with a threshold of 1 as a single owner has complete control of the
     * account during the first user operation.
     */
    error InvalidThreshold();

    /**
     * @notice An error indicating that the user operation `callData` does not correspond to the supported execution
     * function `promoteAccountAndExecuteUserOp`.
     */
    error UnsupportedExecutionFunction(bytes4 selector);

    /**
     * @notice An error indicating that the user operation failed to execute successfully.
     */
    error ExecutionFailed();

    /**
     * @dev Address of the launchpad contract itself. it is used for determining whether or not the contract is being
     * `DELEGATECALL`-ed from a proxy.
     */
    address private immutable _SELF;

    /**
     * @notice The address of the ERC-4337 entry point contract that this launchpad supports.
     */
    address public immutable SUPPORTED_ENTRYPOINT;

    /**
     * @notice Create a new launchpad contract instance.
     * @param entryPoint The address of the ERC-4337 entry point contract that this launchpad supports.
     */
    constructor(address entryPoint) {
        if (entryPoint == address(0)) {
            revert InvalidEntryPoint();
        }

        _SELF = address(this);
        SUPPORTED_ENTRYPOINT = entryPoint;
    }

    /**
     * @notice Validates the call is done via a proxy contract via `DELEGATECALL`, and that the launchpad is not being
     * called directly.
     */
    modifier onlyProxy() {
        if (address(this) == _SELF) {
            revert NotProxied();
        }
        _;
    }

    /**
     * @notice Validates the call is initiated by the supported entry point.
     */
    modifier onlySupportedEntryPoint() {
        if (msg.sender != SUPPORTED_ENTRYPOINT) {
            revert UnsupportedEntryPoint();
        }
        _;
    }

    /**
     * @notice Accept transfers.
     * @dev The launchpad accepts transfers to allow funding of the account in case it was deployed and initialized
     * without pre-funding. Note that it only accepts transfers if it is called via a proxy contract.
     */
    receive() external payable onlyProxy {}

    /**
     * @notice Sets up the account with the specified initialization parameters.
     * @dev This function can only be called by a proxy contract that has not yet been initialized. Internally, it calls
     * the Safe singleton setup function on the account with some pre-determined parameters. In particular, it uses a
     * fixed ownership structure for the deployed Safe.
     * @param singleton The singleton to evolve into during the setup.
     * @param signerFactory The custom ECDSA signer factory to use for creating an owner.
     * @param signerX The X coordinate of the signer's public key.
     * @param signerY The Y coordinate of the signer's public key.
     * @param signerVerifiers The P-256 verifiers to use.
     * @param initializer The Safe setup initializer address.
     * @param initializerData The calldata for the setup `DELEGATECALL`.
     * @param fallbackHandler Handler for fallback calls to the Safe.
     */
    function setup(
        address singleton,
        address signerFactory,
        uint256 signerX,
        uint256 signerY,
        P256.Verifiers signerVerifiers,
        address initializer,
        bytes calldata initializerData,
        address fallbackHandler
    ) external onlyProxy {
        if (_targetSingleton() != address(0)) {
            revert AlreadyInitialized();
        }

        if (singleton == address(0)) {
            revert InvalidSingleton();
        }
        _setTargetSingleton(singleton);

        address[] memory owners = new address[](1);
        owners[0] = ISafeSignerFactory(signerFactory).getSigner(signerX, signerY, signerVerifiers);

        // Call the Safe setup function, making sure to replace the `singleton` that the proxy uses. This is important
        // in order to ensure that the Safe setup function works as expected, in case it calls Safe methods.
        SafeStorage.singleton = singleton;
        ISafe(address(this)).setup(owners, 1, initializer, initializerData, fallbackHandler, address(0), 0, payable(address(0)));
        SafeStorage.singleton = _SELF;

        // We need to check that the setup did not change the threshold to an unsupported value. This is to prevent
        // false security assumptions where the `setup` can be used to add owners and increase the threshold. Since
        // the user operation validation in this contract checks only a single signature, a threshold other than 1 would
        // be ignored for the first user operation before the account gets promoted to a Safe. Since the single owner
        // can change the ownership structure in that single user operation, it is not safe to assume that a threshold
        // other than 1 will be respected. In order to change ownership structures during account creation, instead
        // encode the ownership structure changes in the actual user operation.
        if (threshold != 1) {
            revert InvalidThreshold();
        }
    }

    /**
     * @notice Compute the {SafeInitOp} hash of the first user operation that initializes the Safe.
     * @dev The hash is generated using the keccak256 hash function and the EIP-712 standard. It is signed by the Safe
     * owner that is specified as part of the {SafeInit}. Using a completely separate hash from the {SafeInit} allows
     * the account address to remain the same regardless of the first user operation that gets executed by the account.
     * @param userOpHash The ERC-4337 user operation hash.
     * @param validAfter The timestamp the user operation is valid from.
     * @param validUntil The timestamp the user operation is valid until.
     * @return operationHash The Safe initialization user operation hash.
     */
    function getOperationHash(bytes32 userOpHash, uint48 validAfter, uint48 validUntil) public view returns (bytes32 operationHash) {
        operationHash = keccak256(
            abi.encodePacked(
                bytes2(0x1901),
                domainSeparator(),
                keccak256(abi.encode(SAFE_INIT_OP_TYPEHASH, userOpHash, validAfter, validUntil, SUPPORTED_ENTRYPOINT))
            )
        );
    }

    /**
     * @notice Validates a user operation provided by the entry point.
     * @inheritdoc IAccount
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlySupportedEntryPoint returns (uint256 validationData) {
        bytes4 selector = bytes4(userOp.callData[:4]);
        if (selector != this.promoteAccountAndExecuteUserOp.selector) {
            revert UnsupportedExecutionFunction(selector);
        }

        (address signerFactory, uint256 signerX, uint256 signerY, P256.Verifiers signerVerifiers) = abi.decode(
            userOp.callData[4:],
            (address, uint256, uint256, P256.Verifiers)
        );

        validationData = _validateSignatures(userOp, userOpHash, signerFactory, signerX, signerY, signerVerifiers);
        if (missingAccountFunds > 0) {
            // solhint-disable-next-line no-inline-assembly
            assembly ("memory-safe") {
                // The `pop` is necessary here because solidity 0.5.0 enforces "strict" assembly blocks and "statements
                // (elements of a block) are disallowed if they return something onto the stack at the end". This is not
                // well documented, the quote is taken from <https://github.com/ethereum/solidity/issues/1820>. The
                // compiler will throw an error if we keep the success value on the stack
                pop(call(gas(), caller(), missingAccountFunds, 0, 0, 0, 0))
            }
        }
    }

    /**
     * @notice Completes the account initialization by promoting the account to proxy to the target Safe singleton and
     * deploying the signer contract, and then executes the user operation.
     * @dev This function is only ever called by the entry point as part of the execution phase of the user operation.
     * Validation of the parameters, that they match the ones provided at initialization, is done by {validateUserOp}
     * as part of the the ERC-4337 user operation validation phase.
     * @param signerFactory The custom ECDSA signer factory to use for creating the owner.
     * @param signerX The X coordinate of the signer's public key.
     * @param signerY The Y coordinate of the signer's public key.
     * @param signerVerifiers The P-256 verifiers to use.
     * @param to Destination address of the user operation.
     * @param value Ether value of the user operation.
     * @param data Data payload of the user operation.
     * @param operation Operation type of the user operation.
     */
    function promoteAccountAndExecuteUserOp(
        address signerFactory,
        uint256 signerX,
        uint256 signerY,
        P256.Verifiers signerVerifiers,
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external onlySupportedEntryPoint {
        address singleton = _targetSingleton();
        if (singleton == address(0)) {
            revert AlreadyPromoted();
        }

        SafeStorage.singleton = singleton;
        _setTargetSingleton(address(0));

        ISafeSignerFactory(signerFactory).createSigner(signerX, signerY, signerVerifiers);

        bool success;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            switch operation
            case 0 {
                success := call(gas(), to, value, add(data, 0x20), mload(data), 0, 0)
            }
            case 1 {
                success := delegatecall(gas(), to, add(data, 0x20), mload(data), 0, 0)
            }
            default {
                // The operation does not match one of the expected enum values, revert with the appropriate panic.
                // See <https://docs.soliditylang.org/en/latest/control-structures.html#panic-via-assert-and-error-via-require>.
                mstore(0x00, hex"4e487b71")
                mstore(0x04, 0x21)
            }
        }

        if (!success) {
            revert ExecutionFailed();
        }
    }

    /**
     * @notice Computes the EIP-712 domain separator for Safe launchpad operations.
     * @return domainSeparatorHash The EIP-712 domain separator hash for this contract.
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, _SELF));
    }

    /**
     * @dev Validates that the user operation is correctly signed and returns an ERC-4337 packed validation data
     * of `validAfter || validUntil || authorizer`:
     *  - `authorizer`: 20-byte address, 0 for valid signature or 1 to mark signature failure (this module does not make use of signature aggregators).
     *  - `validUntil`: 6-byte timestamp value, or zero for "infinite". The user operation is valid only up to this time.
     *  - `validAfter`: 6-byte timestamp. The user operation is valid only after this time.
     * @param userOp User operation struct.
     * @param signerFactory The custom ECDSA signer factory to use for creating the owner.
     * @param signerX The X coordinate of the signer's public key.
     * @param signerY The Y coordinate of the signer's public key.
     * @param signerVerifiers The P-256 verifiers to use.
     * @return validationData An integer indicating the result of the validation.
     */
    function _validateSignatures(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        address signerFactory,
        uint256 signerX,
        uint256 signerY,
        P256.Verifiers signerVerifiers
    ) internal view returns (uint256 validationData) {
        uint48 validAfter;
        uint48 validUntil;
        bytes calldata signature;
        {
            bytes calldata sig = userOp.signature;
            validAfter = uint48(bytes6(sig[0:6]));
            validUntil = uint48(bytes6(sig[6:12]));
            signature = sig[12:];
        }

        bytes32 operationHash = getOperationHash(userOpHash, validAfter, validUntil);

        bool failure;
        if (owners[ISafeSignerFactory(signerFactory).getSigner(signerX, signerY, signerVerifiers)] == address(0)) {
            failure = true;
        } else {
            try
                ISafeSignerFactory(signerFactory).isValidSignatureForSigner(operationHash, signature, signerX, signerY, signerVerifiers)
            returns (bytes4 magicValue) {
                failure = magicValue != ERC1271.MAGIC_VALUE;
            } catch {
                failure = true;
            }
        }

        // The timestamps are validated by the entry point, therefore we will not check them again
        validationData = _packValidationData(failure, validUntil, validAfter);
    }

    /**
     * @notice Reads the configured target Safe singleton address to promote to from storage.
     * @return value The target Safe singleton address.
     */
    function _targetSingleton() internal view returns (address value) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            // Note that we explicitly don't mask the address, as Solidity will generate masking code for every time
            // the variable is read.
            value := sload(TARGET_SINGLETON_SLOT)
        }
    }

    /**
     * @notice Sets an target Safe singleton address to promote to in storage.
     * @param value The target Safe singleton address.
     */
    function _setTargetSingleton(address value) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            sstore(TARGET_SINGLETON_SLOT, value)
        }
    }
}
