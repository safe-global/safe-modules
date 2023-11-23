// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {ISignatureValidator} from "@safe-global/safe-contracts/contracts/interfaces/ISignatureValidator.sol";

contract TestSingletonSigner is ISignatureValidator {
    struct Key {
        uint256 _dummy;
        uint256 value;
    }

    mapping(address => Key) public keys;

    function setKey(uint256 key) external {
        keys[msg.sender].value = key;
    }

    function isValidSignature(bytes memory data, bytes memory signatureData) public view virtual override returns (bytes4 magicValue) {
        uint256 message = uint256(keccak256(data));
        uint256 signature = abi.decode(signatureData, (uint256));
        uint256 key = keys[msg.sender].value;

        // A very silly signing scheme where the `message = signature ^ key`
        if (message == signature ^ key) {
            magicValue = this.isValidSignature.selector;
        }
    }
}

contract TestSingletonSignerFactory {
    bytes32 public constant SIGNER_CODE_HASH = keccak256(type(TestSingletonSigner).creationCode);

    function getSigner(uint256 index) public view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), index, SIGNER_CODE_HASH)))));
    }

    function deploySigner(uint256 index) external {
        TestSingletonSigner signer = new TestSingletonSigner{salt: bytes32(index)}();
        require(address(signer) == getSigner(index));
    }
}
