contract TestSafe {
    bool public METHOD_CALLED = false;
    function checkSignatures(bytes32 dataHash, bytes memory, bytes memory signature) public view {
        METHOD_CALLED = true;
    }
}