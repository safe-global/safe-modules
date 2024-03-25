// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import {Base64Url} from "../libraries/Base64Url.sol";

contract TestBase64UrlLib {
    function encode(bytes32 data) public pure returns (string memory) {
        return Base64Url.encode(data);
    }
}
