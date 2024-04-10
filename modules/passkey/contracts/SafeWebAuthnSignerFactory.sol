// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {ICustomECDSASignerFactory} from "./interfaces/ICustomECDSASignerFactory.sol";
import {IP256Verifier} from "./interfaces/IP256Verifier.sol";
import {ERC1271} from "./libraries/ERC1271.sol";
import {WebAuthn} from "./libraries/WebAuthn.sol";
import {SafeWebAuthnSigner} from "./SafeWebAuthnSigner.sol";

/**
 * @title WebAuthnSignerFactory
 * @dev A factory contract for creating and managing WebAuthn signers.
 */
contract SafeWebAuthnSignerFactory is ICustomECDSASignerFactory {
    /**
     * @inheritdoc ICustomECDSASignerFactory
     */
    function getSigner(uint256 x, uint256 y, address verifier) public view override returns (address signer) {
        bytes32 codeHash = keccak256(abi.encodePacked(type(SafeWebAuthnSigner).creationCode, x, y, uint256(uint160(verifier))));
        signer = address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)))));
    }

    /**
     * @inheritdoc ICustomECDSASignerFactory
     */
    function createSigner(uint256 x, uint256 y, address verifier) external returns (address signer) {
        signer = getSigner(x, y, verifier);

        if (_hasNoCode(signer)) {
            SafeWebAuthnSigner created = new SafeWebAuthnSigner{salt: bytes32(0)}(x, y, verifier);
            assert(address(created) == signer);
        }
    }

    /**
     * @inheritdoc ICustomECDSASignerFactory
     */
    function isValidSignatureForSigner(
        bytes32 message,
        bytes calldata signature,
        uint256 x,
        uint256 y,
        address verifier
    ) external view override returns (bytes4 magicValue) {
        if (WebAuthn.verifySignature(message, signature, WebAuthn.USER_VERIFICATION, x, y, IP256Verifier(verifier))) {
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
