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
}