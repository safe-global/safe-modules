// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {ISafeSignerFactory} from "./interfaces/ISafeSignerFactory.sol";
import {SafeWebAuthnSignerProxy} from "./SafeWebAuthnSignerProxy.sol";
import {SafeWebAuthnSignerSingleton} from "./SafeWebAuthnSignerSingleton.sol";
import {P256} from "./libraries/P256.sol";

/**
 * @title SafeWebAuthnSignerFactory
 * @dev A factory contract for creating and managing WebAuthn proxy signers.
 */
contract SafeWebAuthnSignerFactory is ISafeSignerFactory {
    SafeWebAuthnSignerSingleton public immutable SINGLETON;

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
            require(address(created) == signer);
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
    ) external view override returns (bytes4 /*magicValue*/) {
        address singleton = address(SINGLETON);
        bytes memory data = abi.encodePacked(
            abi.encodeCall(SINGLETON.isValidSignature, (message, signature)),
            x,
            y,
            verifiers
        );

        // solhint-disable-next-line no-inline-assembly
        assembly {
            let dataSize := mload(data)
            let dataLocation := add(data, 0x20)

            let success := staticcall(gas(), singleton, dataLocation, dataSize, 0, 0)
            if eq(success, 1) {
                returndatacopy(0, 0, returndatasize())
                return(0, returndatasize())
            }
        }
    }

    /**
     * @dev Checks if the provided account has no code.
     * @param account The address of the account to check.
     * @return True if the account has no code, false otherwise.
     */
    function _hasNoCode(address account) internal view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            size := extcodesize(account)
        }
        return size == 0;
    }
}
