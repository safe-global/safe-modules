// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import {Safe4337Module} from "./../../contracts/Safe4337Module.sol";

contract Safe4337ModuleHarness is Safe4337Module {
    constructor(address entryPoint) Safe4337Module(entryPoint) {}

    function checkSignaturesLength(bytes calldata signatures, uint256 threshold) external pure returns (bool) {
        return _checkSignaturesLength(signatures, threshold);
    }
}
