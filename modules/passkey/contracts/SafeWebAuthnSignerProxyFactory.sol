// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {ICustomECDSASignerProxyFactory} from "./interfaces/ICustomECDSASignerProxyFactory.sol";
import {IP256Verifier} from "./interfaces/IP256Verifier.sol";
import {ERC1271} from "./libraries/ERC1271.sol";
import {WebAuthn} from "./libraries/WebAuthn.sol";
import {SafeWebAuthnSignerProxy} from "./SafeWebAuthnSignerProxy.sol";

/**
 * @title WebAuthnSignerFactory
 * @dev A factory contract for creating and managing WebAuthn signers.
 */
contract SafeWebAuthnSignerProxyFactory is ICustomECDSASignerProxyFactory {
    /**
     * @inheritdoc ICustomECDSASignerProxyFactory
     */
    function getSigner(address singleton, uint256 x, uint256 y, address verifier) public view override returns (address signer) {
        bytes32 codeHash = keccak256(abi.encodePacked(type(SafeWebAuthnSignerProxy).creationCode, singleton));
        bytes32 salt = keccak256(abi.encodePacked(x, y, verifier));
        signer = address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), salt, codeHash)))));
    }

    /**
     * @inheritdoc ICustomECDSASignerProxyFactory
     */
    function createSigner(address singleton, uint256 x, uint256 y, address verifier) external returns (address signer) {
        signer = getSigner(singleton, x, y, verifier);
        bytes32 salt = keccak256(abi.encodePacked(x, y, verifier));
        if (_hasNoCode(signer)) {
            SafeWebAuthnSignerProxy created = new SafeWebAuthnSignerProxy{salt: salt}(singleton);
            require(address(created) == signer);
        }
    }

    /**
     * @inheritdoc ICustomECDSASignerProxyFactory
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
