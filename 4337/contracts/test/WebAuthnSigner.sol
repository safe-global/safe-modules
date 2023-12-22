// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {FCL_WebAuthn} from "./FCL/FCL_Webauthn.sol";
import {IUniqueSignerFactory} from "./SafeSignerLaunchpad.sol";

struct SignatureData {
    bytes authenticatorData;
    bytes clientData;
    uint256 challengeOffset;
    uint256[2] rs;
}

function checkSignature(bytes memory data, bytes calldata signature, uint256 x, uint256 y) view returns (bytes4 magicValue) {
    SignatureData calldata signaturePointer;
    assembly {
        signaturePointer := signature.offset
    }

    if (
        FCL_WebAuthn.checkSignature(
            signaturePointer.authenticatorData,
            0x01, // require user presence
            signaturePointer.clientData,
            keccak256(data),
            signaturePointer.challengeOffset,
            signaturePointer.rs,
            x,
            y
        )
    ) {
        magicValue = WebAuthnSigner.isValidSignature.selector;
    }
}

contract WebAuthnSigner {
    uint256 public immutable X;
    uint256 public immutable Y;

    constructor(uint256 x, uint256 y) {
        X = x;
        Y = y;
    }

    function isValidSignature(bytes memory data, bytes calldata signature) external view returns (bytes4 magicValue) {
        return checkSignature(data, signature, X, Y);
    }
}

contract WebAuthnSignerFactory is IUniqueSignerFactory {
    function getSigner(bytes calldata data) public view returns (address signer) {
        (uint256 x, uint256 y) = abi.decode(data, (uint256, uint256));
        signer = _getSigner(x, y);
    }

    function createSigner(bytes calldata data) external returns (address signer) {
        (uint256 x, uint256 y) = abi.decode(data, (uint256, uint256));
        signer = _getSigner(x, y);
        if (_hasNoCode(signer)) {
            WebAuthnSigner created = new WebAuthnSigner{salt: bytes32(0)}(x, y);
            require(address(created) == signer);
        }
    }

    function isValidSignatureForSigner(
        bytes memory data,
        bytes calldata signature,
        bytes calldata signerData
    ) external view override returns (bytes4 magicValue) {
        (uint256 x, uint256 y) = abi.decode(signerData, (uint256, uint256));
        magicValue = checkSignature(data, signature, x, y);
    }

    function _getSigner(uint256 x, uint256 y) internal view returns (address) {
        bytes32 codeHash = keccak256(abi.encodePacked(type(WebAuthnSigner).creationCode, x, y));
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)))));
    }

    function _hasNoCode(address account) internal view returns (bool) {
        uint256 size;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            size := extcodesize(account)
        }
        /* solhint-enable no-inline-assembly */
        return size == 0;
    }
}
