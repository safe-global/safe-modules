// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity ^0.8.0;

import {IP256Verifier} from "../interfaces/IP256Verifier.sol";
import {P256} from "../libraries/P256.sol";

contract TestWebAuthnSignerFactory {
    function createSigner(address verifier, uint256 x, uint256 y) external returns (TestWebAuthnSigner signer) {
        signer = new TestWebAuthnSigner{salt: 0}(verifier, x, y);
    }
}

contract TestWebAuthnSigner {
    using P256 for IP256Verifier;

    struct SignatureData {
        bytes authenticatorData;
        bytes clientDataFields;
        uint256 r;
        uint256 s;
    }

    string private constant _BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    address private immutable _VERIFIER;
    uint256 private immutable _X;
    uint256 private immutable _Y;

    constructor(address verifier, uint256 x, uint256 y) {
        _VERIFIER = verifier;
        _X = x;
        _Y = y;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue) {
        SignatureData calldata sig;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            sig := signature.offset
        }

        if (
            IP256Verifier(_VERIFIER).verifySignatureAllowMalleability(
                _signingMessage(hash, sig.authenticatorData, sig.clientDataFields),
                sig.r,
                sig.s,
                _X,
                _Y
            )
        ) {
            magicValue = this.isValidSignature.selector;
        }
    }

    function _signingMessage(
        bytes32 challenge,
        bytes calldata authenticatorData,
        bytes calldata clientDataFields
    ) internal pure returns (bytes32 message) {
        /* solhint-disable quotes */
        bytes memory clientDataJson = abi.encodePacked(
            '{"type":"webauthn.get","challenge":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",',
            clientDataFields,
            "}"
        );
        /* solhint-enable quotes */

        string memory alphabet = _BASE64URL;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            let lut := add(alphabet, 1)
            let ptr := add(clientDataJson, 68)

            for {
                let i := 0
            } lt(i, 42) {
                i := add(i, 1)
            } {
                mstore8(add(ptr, i), mload(add(lut, and(0x3f, shr(sub(250, mul(6, i)), challenge)))))
            }
            mstore8(add(ptr, 42), mload(add(lut, and(0x3f, shl(2, challenge)))))
        }

        message = sha256(abi.encodePacked(authenticatorData, sha256(clientDataJson)));
    }
}
