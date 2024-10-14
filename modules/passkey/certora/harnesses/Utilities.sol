import {P256} from "../../contracts/libraries/WebAuthn.sol";

interface IConfigHolder {
    function getConfiguration() external pure returns (uint256 x, uint256 y, P256.Verifiers verifiers);
}

contract Utilities {
    function havocAll() external {
        (bool success, ) = address(0xdeadbeef).call(abi.encodeWithSelector(0x12345678));
        require(success);
    }

    function justRevert() external {
        revert();
    }

    function getConfiguration(address proxy) external view returns (uint256 x, uint256 y, P256.Verifiers verifiers) {
        return IConfigHolder(proxy).getConfiguration();
    }
}
