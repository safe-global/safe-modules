// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.0;

import {ISignatureValidator} from "@safe-global/safe-contracts/contracts/interfaces/ISignatureValidator.sol";
import {IUniqueSignerFactory} from "../experimental/SafeSignerLaunchpad.sol";

function checkSignature(bytes memory data, uint256 signature, uint256 key) pure returns (bytes4 magicValue) {
    uint256 message = uint256(keccak256(data));

    // A very silly signing scheme where the `message = signature ^ key`
    if (message == signature ^ key) {
        magicValue = ISignatureValidator.isValidSignature.selector;
    }
}

contract TestUniqueSigner is ISignatureValidator {
    uint256 public immutable KEY;

    constructor(uint256 key) {
        KEY = key;
    }

    function isValidSignature(bytes memory data, bytes memory signatureData) public view virtual override returns (bytes4 magicValue) {
        uint256 signature = abi.decode(signatureData, (uint256));
        magicValue = checkSignature(data, signature, KEY);
    }
}

contract TestUniqueSignerFactory is IUniqueSignerFactory {
    function getSigner(bytes calldata data) public view returns (address signer) {
        uint256 key = abi.decode(data, (uint256));
        signer = _getSigner(key);
    }

    function createSigner(bytes calldata data) external returns (address signer) {
        uint256 key = abi.decode(data, (uint256));
        signer = _getSigner(key);
        if (_hasNoCode(signer)) {
            TestUniqueSigner created = new TestUniqueSigner{salt: bytes32(0)}(key);
            require(address(created) == signer);
        }
    }

    function isValidSignatureForSigner(
        bytes memory data,
        bytes memory signatureData,
        bytes memory signerData
    ) external pure override returns (bytes4 magicValue) {
        uint256 key = abi.decode(signerData, (uint256));
        uint256 signature = abi.decode(signatureData, (uint256));
        magicValue = checkSignature(data, signature, key);
    }

    function _getSigner(uint256 key) internal view returns (address) {
        bytes32 codeHash = keccak256(abi.encodePacked(type(TestUniqueSigner).creationCode, key));
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)))));
    }

    function _hasNoCode(address account) internal view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            size := extcodesize(account)
        }
        return size == 0;
    }
}
