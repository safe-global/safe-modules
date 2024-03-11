// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {ICustom256BitECSignerFactory} from "./interfaces/ICustomSignerFactory.sol";
import {IWebAuthnVerifier} from "./interfaces/IWebAuthnVerifier.sol";
import {ERC1271} from "./libraries/ERC1271.sol";
import {WebAuthnFlags} from "./libraries/WebAuthnFlags.sol";
import {WebAuthnSignature} from "./libraries/WebAuthnSignature.sol";
import {WebAuthnSigner} from "./WebAuthnSigner.sol";

/**
 * @title WebAuthnSignerFactory
 * @dev A factory contract for creating and managing WebAuthn signers.
 */
contract WebAuthnSignerFactory is ICustom256BitECSignerFactory {
    // @inheritdoc ICustom256BitECSignerFactory
    function getSigner(uint256 qx, uint256 qy, address verifier) public view override returns (address signer) {
        bytes32 codeHash = keccak256(abi.encodePacked(type(WebAuthnSigner).creationCode, qx, qy, uint256(uint160(verifier))));
        signer = address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)))));
    }

    // @inheritdoc ICustom256BitECSignerFactory
    function createSigner(uint256 qx, uint256 qy, address verifier) external returns (address signer) {
        signer = getSigner(qx, qy, verifier);

        if (_hasNoCode(signer) && _validVerifier(verifier)) {
            WebAuthnSigner created = new WebAuthnSigner{salt: bytes32(0)}(qx, qy, verifier);
            require(address(created) == signer);
        }
    }

    // @inheritdoc ICustom256BitECSignerFactory
    function isValidSignatureForSigner(
        uint256 qx,
        uint256 qy,
        address verifier,
        bytes32 message,
        bytes calldata signature
    ) external view override returns (bytes4 magicValue) {
        WebAuthnSignature.Data calldata data = WebAuthnSignature.cast(signature);

        // Work around stack-too-deep issues by helping out the compiler figure out how to re-order
        // the stack.
        uint256 x = qx;
        uint256 y = qy;

        if (
            IWebAuthnVerifier(verifier).verifyWebAuthnSignatureAllowMalleability(
                data.authenticatorData,
                WebAuthnFlags.USER_VERIFICATION,
                message,
                data.clientDataFields,
                data.r,
                data.s,
                x,
                y
            )
        ) {
            magicValue = ERC1271.MAGIC_VALUE;
        }
    }

    /**
     * @dev Checks if the given verifier address contains code.
     * @param verifier The address of the verifier to check.
     * @return A boolean indicating whether the verifier contains code or not.
     */
    function _validVerifier(address verifier) internal view returns (bool) {
        // The verifier should contain code (The only way to implement a webauthn verifier is with a smart contract)
        return !_hasNoCode(verifier);
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
