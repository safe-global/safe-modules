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
     * @notice The storage slot used for the initialization hash of account.
     * @custom:computed-as keccak256("SafeSignerLaunchpad.initHash") - 1
     * @dev This value is intentionally computed to be a hash -1 as a precaution to avoid any potential issues from
     * unintended hash collisions.
     */
    uint256 private constant INIT_HASH_SLOT = 0xf69b06f613646416443af565ceba6ea1636a94376678b14dc8481b819746897f;

    /**
     * @notice The keccak256 hash of the EIP-712 SafeInit struct, representing the structure of a ERC-4337 compatible deferred Safe initialization.
     *  {address} singleton - The singleton to evolve into during the setup.
     *  {address} signerFactory - The custom ECDSA signer factory to use for creating an owner.
     *  {uint256} signerX - The X coordinate of the public key of the custom ECDSA signing scheme.
     *  {uint256} signerY - The Y coordinate of the public key of the custom ECDSA signing scheme.
     *  {uint256} signerVerifiers - The P-256 verifiers to use for signature validation.
     *  {address} setupTo - The contract to `DELEGATECALL` during setup.
     *  {bytes} setupData - The calldata for the setup `DELEGATECALL`.
     *  {address} fallbackHandler - The fallback handler to initialize the Safe with.
     * @custom:computed-as keccak256("SafeInit(address singleton,address signerFactory,uint256 signerX,uint256 signerY,uint192 signerVerifiers,address setupTo,bytes setupData,address fallbackHandler)")
     */
    bytes32 private constant SAFE_INIT_TYPEHASH = 0xb8b5d6678d8c3ed815330874b6c0a30142f64104b7f6d1361d6775a7dbc5318b;

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
     * @dev Address of the launchpad contract itself. it is used for determining whether or not the contract is being
     * `DELEGATECALL`-ed from a proxy.
     */
    address private immutable SELF;

    /**
     * @notice The address of the ERC-4337 entry point contract that this launchpad supports.
     */
    address public immutable SUPPORTED_ENTRYPOINT;

    /**
     * @notice Create a new launchpad contract instance.
     * @param entryPoint The address of the ERC-4337 entry point contract that this launchpad supports.
     */
    constructor(address entryPoint) {
        require(entryPoint != address(0), "Invalid entry point");

        SELF = address(this);
        SUPPORTED_ENTRYPOINT = entryPoint;
    }

    /**
     * @notice Validates the call is done via a proxy contract via `DELEGATECALL`, and that the launchpad is not being
     * called directly.
     */
    modifier onlyProxy() {
        require(singleton == SELF, "Not called from proxy");
        _;
    }

    /**
     * @notice Validates the call is initiated by the supported entry point.
     */
    modifier onlySupportedEntryPoint() {
        require(msg.sender == SUPPORTED_ENTRYPOINT, "Unsupported entry point");
        _;
    }

    /**
     * @notice Accept transfers.
     * @dev The launchpad accepts transfers to allow funding of the account in case it was deployed and initialized
     * without pre-funding.
     */
    receive() external payable {}

    /**
     * @notice Performs pre-validation setup by storing the hash of the {SafeInit} and optionally `DELEGATECALL`s to a
     * `preInitializer` contract to perform some initial setup.
     * @dev Requirements:
     * - The function can only be called by a proxy contract.
     * - The `DELEGATECALL` to the `preInitializer` address must succeed.
     * @param initHash The initialization hash.
     * @param preInitializer The address to `DELEGATECALL`.
     * @param preInitializerData The pre-initialization call data.
     */
    function preValidationSetup(bytes32 initHash, address preInitializer, bytes calldata preInitializerData) external onlyProxy {
        _setInitHash(initHash);
        if (preInitializer != address(0)) {
            (bool success, ) = preInitializer.delegatecall(preInitializerData);
            require(success, "Pre-initialization failed");
        }
    }

    /**
     * @notice Compute an {SafeInit} hash that uniquely identifies a Safe configuration.
     * @dev The hash is generated using the keccak256 hash function and the EIP-712 standard. It includes setup
     * parameters to ensure that deployments with the Safe proxy factory have a unique and deterministic address for a
     * given configuration.
     * @param singleton The singleton to evolve into during the setup.
     * @param signerFactory The custom ECDSA signer factory to use for creating an owner.
     * @param signerX The X coordinate of the signer's public key.
     * @param signerY The Y coordinate of the signer's public key.
     * @param signerVerifiers The P-256 verifiers to use for signature validation.
     * @param setupTo The contract to `DELEGATECALL` during setup.
     * @param setupData The calldata for the setup `DELEGATECALL`.
     * @param fallbackHandler The fallback handler to initialize the Safe with.
     * @return initHash The unique initialization hash for the Safe.
     */
    function getInitHash(
        address singleton,
        address signerFactory,
        uint256 signerX,
        uint256 signerY,
        P256.Verifiers signerVerifiers,
        address setupTo,
        bytes memory setupData,
        address fallbackHandler
    ) public view returns (bytes32 initHash) {
        initHash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x01),
                domainSeparator(),
                keccak256(
                    abi.encode(
                        SAFE_INIT_TYPEHASH,
                        singleton,
                        signerFactory,
                        signerX,
                        signerY,
                        signerVerifiers,
                        setupTo,
                        keccak256(setupData),
                        fallbackHandler
                    )
                )
            )
        );
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
                bytes1(0x19),
                bytes1(0x01),
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
    ) external override onlyProxy onlySupportedEntryPoint returns (uint256 validationData) {
        address signerFactory;
        uint256 signerX;
        uint256 signerY;
        P256.Verifiers signerVerifiers;
        {
            require(this.initializeThenUserOp.selector == bytes4(userOp.callData[:4]), "invalid user operation data");

            address singleton;
            address setupTo;
            bytes memory setupData;
            address fallbackHandler;
            (singleton, signerFactory, signerX, signerY, signerVerifiers, setupTo, setupData, fallbackHandler, ) = abi.decode(
                userOp.callData[4:],
                (address, address, uint256, uint256, P256.Verifiers, address, bytes, address, bytes)
            );
            bytes32 initHash = getInitHash(
                singleton,
                signerFactory,
                signerX,
                signerY,
                signerVerifiers,
                setupTo,
                setupData,
                fallbackHandler
            );

            require(initHash == _initHash(), "invalid init hash");
        }

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
     * @notice Completes the account initialization and then executes a user operation.
     * @dev This function is only ever called by the entry point as part of the execution phase of the user operation.
     * It is responsible for promoting the account into a Safe. Validation of the parameters, that they match the
     * {SafeInit} hash that was specified at account construction, is done by {validateUserOp} as part of the the
     * ERC-4337 user operation validation phase.
     * @param singleton The Safe singleton address to promote the account into.
     * @param signerFactory The custom ECDSA signer factory to use for creating an owner.
     * @param signerX The X coordinate of the signer's public key.
     * @param signerY The Y coordinate of the signer's public key.
     * @param signerVerifiers The P-256 verifiers to use for signature validation.
     * @param setupTo The contract to `DELEGATECALL` during setup.
     * @param setupData The calldata for the setup `DELEGATECALL`.
     * @param fallbackHandler The fallback handler to initialize the Safe with.
     * @param callData The calldata to `DELEGATECALL` self with in order to actually execute the user operation.
     */
    function initializeThenUserOp(
        address singleton,
        address signerFactory,
        uint256 signerX,
        uint256 signerY,
        P256.Verifiers signerVerifiers,
        address setupTo,
        bytes calldata setupData,
        address fallbackHandler,
        bytes memory callData
    ) external onlySupportedEntryPoint {
        SafeStorage.singleton = singleton;
        {
            address[] memory owners = new address[](1);
            owners[0] = ISafeSignerFactory(signerFactory).createSigner(signerX, signerY, signerVerifiers);

            ISafe(address(this)).setup(owners, 1, setupTo, setupData, fallbackHandler, address(0), 0, payable(address(0)));
        }

        (bool success, bytes memory returnData) = address(this).delegatecall(callData);
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly ("memory-safe") {
                revert(add(returnData, 0x20), mload(returnData))
            }
        }

        _setInitHash(0);
    }

    /**
     * @notice Computes the EIP-712 domain separator for Safe launchpad operations.
     * @return domainSeparatorHash The EIP-712 domain separator hash for this contract.
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, SELF));
    }

    /**
     * @dev Validates that the user operation is correctly signed and returns an ERC-4337 packed validation data
     * of `validAfter || validUntil || authorizer`:
     *  - `authorizer`: 20-byte address, 0 for valid signature or 1 to mark signature failure (this module does not make use of signature aggregators).
     *  - `validUntil`: 6-byte timestamp value, or zero for "infinite". The user operation is valid only up to this time.
     *  - `validAfter`: 6-byte timestamp. The user operation is valid only after this time.
     * @param userOp User operation struct.
     * @param userOpHash User operation hash.
     * @param signerFactory The custom ECDSA signer factory to use for creating an owner.
     * @param signerX The X coordinate of the signer's public key.
     * @param signerY The Y coordinate of the signer's public key.
     * @param signerVerifiers The P-256 verifiers to use for signature validation.
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
        try
            ISafeSignerFactory(signerFactory).isValidSignatureForSigner(operationHash, signature, signerX, signerY, signerVerifiers)
        returns (bytes4 magicValue) {
            // The timestamps are validated by the entry point, therefore we will not check them again
            validationData = _packValidationData(magicValue != ERC1271.MAGIC_VALUE, validUntil, validAfter);
        } catch {
            validationData = _packValidationData(true, validUntil, validAfter);
        }
    }

    /**
     * @notice Reads the configured initialization hash from storage.
     * @return value The value of the init hash read from storage.
     */
    function _initHash() public view returns (bytes32 value) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            value := sload(INIT_HASH_SLOT)
        }
    }

    /**
     * @notice Sets an initialization hash in storage.
     * @param value The value of the init hash to set in storage.
     */
    function _setInitHash(bytes32 value) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            sstore(INIT_HASH_SLOT, value)
        }
    }

    /**
     * @notice Returns whether or not an account is a contract.
     * @dev The current implementation the accounts code size is non-zero to determine whether or not the account is a
     * contract.
     * @param account The account to check.
     * @return isContract Whether or not the account is a contract.
     */
    function _isContract(address account) internal view returns (bool isContract) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            size := extcodesize(account)
        }
        isContract = size > 0;
    }
}
