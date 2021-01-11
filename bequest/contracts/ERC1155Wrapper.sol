// // SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.5.17;
// pragma abicoder v2;
// import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
// import { MyOwnable } from "./MyOwnable.sol";
// import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

// /// This contract does NOT emit events.
// /// TODO
// contract GnosisSafeERC1155Wrapper is /*IERC1155,*/ MyOwnable {
//     struct Token {
//         address contractAddress;
//         uint256 tokenId;
//     }
    
//     mapping (uint64 => Token) public tokens;
//     uint64 maxId;

//     constructor (address initialOwner) MyOwnable(initialOwner) { }

//     function newToken(Token calldata token) public {
//         tokens[maxId++] = token;
//         // TODO: event?
//     }

//     // function balanceOf(address account, uint256 id) external override view returns (uint256) {

//     // }

//     // function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external override view returns (uint256[] memory) {

//     // }

//     // function isApprovedForAll(address account, address operator) external override view returns (bool) {

//     // }

//     // function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external override {

//     // }

//     // function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external override {

//     // }

//     // function setApprovalForAll(address operator, bool approved) external override {

//     // }

//     // function supportsInterface(bytes4 interfaceId) external override view returns (bool) {

//     // }

//     function execute(uint64 id) internal {
//         Token storage token = tokens[id]; // TODO: Should check if id < maxId?
//         address erc1155 = token.contractAddress;
//         // FIXME: Reentrancy vulnaberity?
//         // bytes memory returnData = wallet.executeReturnData(erc1155, 0, data, Enum.Operation.Call);
//         // FIXME
//     }
// }