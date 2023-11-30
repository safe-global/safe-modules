// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract XanderBlazeNFT is ERC721 {
    constructor() ERC721("XanderBlazeNFT", "XBN") {}

    // @dev This can be called by anyone.
    function safeMint(address to, uint256 tokenId) public {
        _safeMint(to, tokenId, "");
    }
}
