// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SafeWebAuthnSignerFactory} from "../munged/SafeWebAuthnSignerFactory.sol";
import {P256} from "../../contracts/libraries/P256.sol";
import {SafeWebAuthnSignerProxy} from "../../contracts/SafeWebAuthnSignerProxy.sol";

contract GetSignerHarness is SafeWebAuthnSignerFactory {
    function getSignerHarnessed(uint256 x, uint256 y, P256.Verifiers verifiers) public view returns (uint256 value) {
        bytes32 codeHash = keccak256(
            abi.encodePacked(
                type(SafeWebAuthnSignerProxy).creationCode,
                "01234567891011121314152546",
                uint256(uint160(address(SINGLETON))),
                x,
                y,
                uint256(P256.Verifiers.unwrap(verifiers))
            )
        );
        value = uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)));
    }
    function castToAddress(uint256 value) public pure returns (address addr) {
        addr = address(uint160(value));
    }

    /**
     * munged getSigner
     */
    function getSigner(uint256 x, uint256 y, P256.Verifiers verifiers) public view override returns (address signer) {
        bytes32 codeHash = keccak256(
            abi.encodePacked(
                type(SafeWebAuthnSignerProxy).creationCode,
                "01234567891011121314152546", // munged for word alignment workaround (32 bytes)
                uint256(uint160(address(SINGLETON))),
                x,
                y,
                uint256(P256.Verifiers.unwrap(verifiers))
            )
        );
        signer = address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)))));
    }
}
