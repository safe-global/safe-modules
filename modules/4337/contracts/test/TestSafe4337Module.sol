// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import {Safe4337Module} from "../Safe4337Module.sol";

contract TestSafe4337Module is Safe4337Module {
    constructor(address entryPoint) Safe4337Module(entryPoint) {}

    function checkSignatureLength(bytes calldata signature, uint256 threshold) external pure returns (bool) {
        return _checkSignatureLength(signature, threshold);
    }
}
