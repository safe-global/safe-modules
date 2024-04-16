// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {ISafeSignerFactory} from "./interfaces/ISafeSignerFactory.sol";
import {ERC1271} from "./libraries/ERC1271.sol";
import {P256, WebAuthn} from "./libraries/WebAuthn.sol";
import {SafeWebAuthnSigner} from "./SafeWebAuthnSigner.sol";

/**
 * @title WebAuthnSignerFactory
 * @dev A factory contract for creating and managing WebAuthn signers.
 */
contract SafeWebAuthnSignerFactory is ISafeSignerFactory {
    /**
     * @inheritdoc ISafeSignerFactory
     */
    function getSigner(uint256 x, uint256 y, P256.Verifiers verifiers) public view override returns (address signer) {
        bytes32 codeHash = keccak256(
            abi.encodePacked(type(SafeWebAuthnSigner).creationCode, x, y, uint256(P256.Verifiers.unwrap(verifiers)))
        );
        signer = address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)))));
    }

    /**
     * @inheritdoc ISafeSignerFactory
     */
    function createSigner(uint256 x, uint256 y, P256.Verifiers verifiers) external returns (address signer) {
        signer = getSigner(x, y, verifiers);

        if (_hasNoCode(signer)) {
            SafeWebAuthnSigner created = new SafeWebAuthnSigner{salt: bytes32(0)}(x, y, verifiers);
            assert(address(created) == signer);
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
        if (WebAuthn.verifySignature(message, signature, WebAuthn.USER_VERIFICATION, x, y, verifiers)) {
            magicValue = ERC1271.MAGIC_VALUE;
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
