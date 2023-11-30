// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {ISignatureValidator} from "@safe-global/safe-contracts/contracts/interfaces/ISignatureValidator.sol";

contract TestUniqueSigner is ISignatureValidator {
    uint256 public immutable KEY;

    constructor(uint256 key) {
        KEY = key;
    }

    function isValidSignature(bytes memory data, bytes memory signatureData) public view virtual override returns (bytes4 magicValue) {
        uint256 message = uint256(keccak256(data));
        uint256 signature = abi.decode(signatureData, (uint256));

        // A very silly signing scheme where the `message = signature ^ key`
        if (message == signature ^ KEY) {
            magicValue = this.isValidSignature.selector;
        }
    }
}

contract TestUniqueSignerFactory {
    function getSigner(uint256 key) public view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), _signerCodeHash(key))))));
    }

    function deploySigner(uint256 key) external {
        TestUniqueSigner signer = new TestUniqueSigner{salt: bytes32(0)}(key);
        require(address(signer) == getSigner(key));
    }

    function _signerCodeHash(uint256 key) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(type(TestUniqueSigner).creationCode, key));
    }
}
