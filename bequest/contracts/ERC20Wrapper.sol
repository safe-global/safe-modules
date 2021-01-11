// // SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.5.17;
// import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
// import { MyOwnable } from "./MyOwnable.sol";
// import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";
 
// /// This contract does NOT emit events.
// /// TODO
// contract GnosisSafeERC20Wrapper is /*IERC1155,*/ MyOwnable {
//     constructor (address initialOwner) MyOwnable(initialOwner) { }

//     // function balanceOf(address account, uint256 id) external override view returns (uint256) {

//     // }

//     // function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external override view returns (uint256[] memory) {

//     // }

//     // function isApprovedForAll(address account, address operator) external override view returns (bool) onlyOwner {

//     // }

//     // function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external override onlyOwner {

//     // }

//     // function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external override onlyOwner {

//     // }

//     // function setApprovalForAll(address operator, bool approved) external override onlyOwner {

//     // }

//     // function supportsInterface(bytes4 interfaceId) external override view returns (bool) onlyOwner {

//     // }

//     function execute(uint256 id) internal {
//         address erc20 = address(id);
//         // FIXME: Reentrancy vulnaberity?
//         // bytes memory returnData = wallet.executeReturnData(erc20, 0, data, Enum.Operation.Call);
//         // FIXME
//     }
// }