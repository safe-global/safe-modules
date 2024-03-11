// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
import {SafeStorage} from "@safe-global/safe-contracts/contracts/libraries/SafeStorage.sol";

import {ICustom256BitECSignerFactory} from "../interfaces/ICustomSignerFactory.sol";
import {ISafe} from "../interfaces/ISafe.sol";
import {ERC1271} from "../libraries/ERC1271.sol";

/**
 * @title SafeOpLaunchpad - A contract for Safe initialization with custom unique signers that would violate ERC-4337 factory rules.
 * @dev The is intended to be set as a Safe proxy's implementation for ERC-4337 user operation that deploys the account.
 */
contract Safe256BitECSignerLaunchpad is IAccount, SafeStorage {
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    // keccak256("SafeSignerLaunchpad.initHash") - 1
    uint256 private constant INIT_HASH_SLOT = 0x1d2f0b9dbb6ed3f829c9614e6c5d2ea2285238801394dc57e8500e0e306d8f80;

    /**
     * @notice The keccak256 hash of the EIP-712 SafeInit struct, representing the structure of a ERC-4337 compatible deferred Safe initialization.
     *  {address} singleton - The singleton to evolve into during the setup.
     *  {address} signerFactory - The unique signer factory to use for creating an owner.
     *  {bytes} signerData - The signer data to use the owner.
     *  {address} setupTo - The contract to delegatecall during setup.
     *  {bytes} setupData - The calldata for the setup delegatecall.
     *  {address} fallbackHandler - The fallback handler to initialize the Safe with.
     */
    bytes32 private constant SAFE_INIT_TYPEHASH =
        keccak256(
            "SafeInit(address singleton,address signerFactory,uint256 signerX,uint256 signerY,address signerVerifier,address setupTo,bytes setupData,address fallbackHandler)"
        );

    /**
     * @notice The keccak256 hash of the EIP-712 SafeInitOp struct, representing the user operation to execute alongside initialization.
     *  {bytes32} userOpHash - The user operation hash being executed.
     *  {uint48} validAfter - A timestamp representing from when the user operation is valid.
     *  {uint48} validUntil - A timestamp representing until when the user operation is valid, or 0 to indicated "forever".
     *  {address} entryPoint - The address of the entry point that will execute the user operation.
     */
    bytes32 private constant SAFE_INIT_OP_TYPEHASH =
        keccak256("SafeInitOp(bytes32 userOpHash,uint48 validAfter,uint48 validUntil,address entryPoint)");

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

    receive() external payable {}

    /**
     * @dev Performs pre-validation setup by storing the hash of the Safe setup (owners, threshold, etc)
     * and executes an optional delegatecall to the `to` address.
     * Requirements:
     * - The function can only be called by the proxy contract.
     * - The delegatecall to the `to` address must succeed.
     * @param initHash The initialization hash.
     * @param to The address to delegatecall.
     * @param preInit The pre-initialization call data.
     */
    function preValidationSetup(bytes32 initHash, address to, bytes calldata preInit) external onlyProxy {
        _setInitHash(initHash);
        if (to != address(0)) {
            (bool success, ) = to.delegatecall(preInit);
            require(success, "Pre-initialization failed");
        }
    }

    function getInitHash(
        address singleton,
        address signerFactory,
        uint256 signerX,
        uint256 signerY,
        address signerVerifier,
        address setupTo,
        bytes memory setupData,
        address fallbackHandler
    ) public view returns (bytes32 initHash) {
        initHash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x01),
                _domainSeparator(),
                keccak256(
                    abi.encode(
                        SAFE_INIT_TYPEHASH,
                        singleton,
                        signerFactory,
                        signerX,
                        signerY,
                        signerVerifier,
                        setupTo,
                        keccak256(setupData),
                        fallbackHandler
                    )
                )
            )
        );
    }

    function getOperationHash(bytes32 userOpHash, uint48 validAfter, uint48 validUntil) public view returns (bytes32 operationHash) {
        operationHash = keccak256(_getOperationData(userOpHash, validAfter, validUntil));
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyProxy onlySupportedEntryPoint returns (uint256 validationData) {
        address signerFactory;
        uint256 signerX;
        uint256 signerY;
        address signerVerifier;
        {
            require(this.initializeThenUserOp.selector == bytes4(userOp.callData[:4]), "invalid user operation data");

            address singleton;
            address setupTo;
            bytes memory setupData;
            address fallbackHandler;
            (singleton, signerFactory, signerX, signerY, signerVerifier, setupTo, setupData, fallbackHandler, ) = abi.decode(
                userOp.callData[4:],
                (address, address, uint256, uint256, address, address, bytes, address, bytes)
            );
            bytes32 initHash = getInitHash(singleton, signerFactory, signerX, signerY, signerVerifier, setupTo, setupData, fallbackHandler);

            require(initHash == _initHash(), "invalid init hash");
        }

        validationData = _validateSignatures(userOp, userOpHash, signerFactory, signerX, signerY, signerVerifier);
        if (missingAccountFunds > 0) {
            // solhint-disable-next-line no-inline-assembly
            assembly ("memory-safe") {
                // The `pop` is necessary here because solidity 0.5.0
                // enforces "strict" assembly blocks and "statements (elements of a block) are disallowed if they return something onto the stack at the end."
                // This is not well documented, the quote is taken from here:
                // https://github.com/ethereum/solidity/issues/1820
                // The compiler will throw an error if we keep the success value on the stack
                pop(call(gas(), caller(), missingAccountFunds, 0, 0, 0, 0))
            }
        }
    }

    /**
     * @dev Validates that the user operation is correctly signed and returns an ERC-4337 packed validation data
     * of `validAfter || validUntil || authorizer`:
     *  - `authorizer`: 20-byte address, 0 for valid signature or 1 to mark signature failure (this module does not make use of signature aggregators).
     *  - `validUntil`: 6-byte timestamp value, or zero for "infinite". The user operation is valid only up to this time.
     *  - `validAfter`: 6-byte timestamp. The user operation is valid only after this time.
     * @param userOp User operation struct.
     * @return validationData An integer indicating the result of the validation.
     */
    function _validateSignatures(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        address signerFactory,
        uint256 signerX,
        uint256 signerY,
        address signerVerifier
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

        bytes memory operationData = _getOperationData(userOpHash, validAfter, validUntil);
        bytes32 operationHash = keccak256(operationData);
        try
            ICustom256BitECSignerFactory(signerFactory).isValidSignatureForSigner(
                signerX,
                signerY,
                signerVerifier,
                operationHash,
                signature
            )
        returns (bytes4 magicValue) {
            // The timestamps are validated by the entry point, therefore we will not check them again
            validationData = _packValidationData(magicValue != ERC1271.MAGIC_VALUE, validUntil, validAfter);
        } catch {
            validationData = _packValidationData(true, validUntil, validAfter);
        }
    }

    function initializeThenUserOp(
        address singleton,
        address signerFactory,
        uint256 signerX,
        uint256 signerY,
        address signerVerifier,
        address setupTo,
        bytes calldata setupData,
        address fallbackHandler,
        bytes memory callData
    ) external onlySupportedEntryPoint {
        SafeStorage.singleton = singleton;
        {
            address[] memory owners = new address[](1);
            owners[0] = ICustom256BitECSignerFactory(signerFactory).createSigner(signerX, signerY, signerVerifier);

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

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, SELF));
    }

    function _getOperationData(
        bytes32 userOpHash,
        uint48 validAfter,
        uint48 validUntil
    ) internal view returns (bytes memory operationData) {
        operationData = abi.encodePacked(
            bytes1(0x19),
            bytes1(0x01),
            _domainSeparator(),
            keccak256(abi.encode(SAFE_INIT_OP_TYPEHASH, userOpHash, validAfter, validUntil, SUPPORTED_ENTRYPOINT))
        );
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
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
