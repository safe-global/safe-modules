contract ISafe {
    function checkSignatures(bytes32 dataHash, bytes memory, bytes memory signature) public view {
        return;
    }

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
}