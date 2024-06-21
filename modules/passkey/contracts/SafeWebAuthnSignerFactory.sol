// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.24;

import {ISafeSignerFactory} from "./interfaces/ISafeSignerFactory.sol";
import {SafeWebAuthnSignerProxy} from "./SafeWebAuthnSignerProxy.sol";
import {SafeWebAuthnSignerSingleton} from "./SafeWebAuthnSignerSingleton.sol";
import {P256} from "./libraries/P256.sol";

/**
 * @title Safe WebAuthn Signer Factory
 * @dev A factory contract for creating WebAuthn signers. Additionally, the factory supports
 * signature verification without deploying a signer proxies.
 * @custom:security-contact bounty@safe.global
 */
contract SafeWebAuthnSignerFactory is ISafeSignerFactory {
    /**
     * @notice The {SafeWebAuthnSignerSingleton} implementation to that is used for signature
     * verification by this contract and any proxies it deploys.
     */
    SafeWebAuthnSignerSingleton public immutable SINGLETON;

    /**
     * @notice Creates a new WebAuthn Safe signer factory contract.
     * @dev The {SafeWebAuthnSignerSingleton} singleton implementation is created with as part of
     * this constructor. This ensures that the singleton contract is known, and lets us make certain
     * assumptions about how it works.
     */
    constructor() {
        SINGLETON = new SafeWebAuthnSignerSingleton();
    }

    /**
     * @inheritdoc ISafeSignerFactory
     */
    function getSigner(uint256 x, uint256 y, P256.Verifiers verifiers) public view override returns (address signer) {
        bytes32 codeHash = keccak256(
            abi.encodePacked(
                type(SafeWebAuthnSignerProxy).creationCode,
                uint256(uint160(address(SINGLETON))),
                x,
                y,
                uint256(P256.Verifiers.unwrap(verifiers))
            )
        );
        signer = address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)))));
    }

    /**
     * @inheritdoc ISafeSignerFactory
     */
    function createSigner(uint256 x, uint256 y, P256.Verifiers verifiers) external returns (address signer) {
        signer = getSigner(x, y, verifiers);

        if (_hasNoCode(signer)) {
            SafeWebAuthnSignerProxy created = new SafeWebAuthnSignerProxy{salt: bytes32(0)}(address(SINGLETON), x, y, verifiers);
            assert(address(created) == signer);
            emit Created(signer, x, y, verifiers);
        }
    }

    /**
     * @inheritdoc ISafeSignerFactory
     */
    function isValidSignatureForSigner(
        bytes32 message,
        bytes calldata signature,
        uint256 x,
        uint256 y,
        P256.Verifiers verifiers
    ) external view override returns (bytes4 magicValue) {
        address singleton = address(SINGLETON);
        bytes memory data = abi.encodePacked(
            abi.encodeWithSignature("isValidSignature(bytes32,bytes)", message, signature),
            x,
            y,
            verifiers
        );

        // solhint-disable-next-line no-inline-assembly
        assembly {
            // staticcall to the singleton contract with return size given as 32 bytes. The
            // singleton contract is known and immutable so it is safe to specify return size.
            if staticcall(gas(), singleton, add(data, 0x20), mload(data), 0, 32) {
                magicValue := mload(0)
            }
        }
    }

    /**
     * @dev Checks if the provided account has no code.
     * @param account The address of the account to check.
     * @return result True if the account has no code, false otherwise.
     */
    function _hasNoCode(address account) internal view returns (bool result) {
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            result := iszero(extcodesize(account))
        }
    }
}
