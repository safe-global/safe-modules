// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity ^0.8.0;

import {IP256Verifier, P256} from "../libraries/P256.sol";
import {WebAuthn} from "../libraries/WebAuthn.sol";

contract TestWebAuthnSignerFactory {
    function createSigner(address verifier, uint256 x, uint256 y) external returns (TestWebAuthnSigner signer) {
        signer = new TestWebAuthnSigner{salt: 0}(verifier, x, y);
    }
}

contract TestWebAuthnSigner {
    using P256 for IP256Verifier;

    address private immutable _VERIFIER;
    uint256 private immutable _X;
    uint256 private immutable _Y;

    constructor(address verifier, uint256 x, uint256 y) {
        _VERIFIER = verifier;
        _X = x;
        _Y = y;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue) {
        if (WebAuthn.verifySignature(hash, signature, WebAuthn.USER_VERIFICATION, _X, _Y, IP256Verifier(_VERIFIER))) {
            magicValue = this.isValidSignature.selector;
        }
    }
}
