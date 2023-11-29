// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import "@safe-global/safe-contracts/contracts/Safe.sol";
contract ISafe2 {
   
    function getSignatureTimestamps(bytes calldata signature) external returns (uint96 slice) {
        slice = uint96(bytes12(signature[:12]));
    }

    function getSignatures(bytes calldata signature) external returns (bytes memory slice) {
        slice = signature[12:];
    }

    function getValidAfterTimestamp(bytes calldata sigs) external pure returns (uint48) {
        return uint48(bytes6(sigs[:6]));
    }

    function getValidUntilTimestamp(bytes calldata sigs) external pure returns (uint48) {
        return uint48(bytes6(sigs[6:12]));
    }

    function getSignatureTimestampsFromValidationData(uint256 validationData) external pure returns (uint96) {
        return uint96(validationData >> 160);
    }

    function checkSignatures(bytes32, bytes memory, bytes memory) public view {
        revert();
    }
}