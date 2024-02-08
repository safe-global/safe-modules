// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

contract InitCode {
    struct Config {
        address safeModuleSetup;
        address erc4337module;
        address safeSingleton;
        address proxyFactory;
    }

    address public immutable SAFE_MODULE_SETUP_ADDRESS;
    address public immutable SAFE_4337_MODULE_ADDRESS;
    address public immutable SAFE_SINGLETON_ADDRESS;
    address public immutable SAFE_PROXY_FACTORY_ADDRESS;

    constructor(Config memory config) {
        SAFE_MODULE_SETUP_ADDRESS = config.safeModuleSetup;
        SAFE_4337_MODULE_ADDRESS = config.erc4337module;
        SAFE_SINGLETON_ADDRESS = config.safeSingleton;
        SAFE_PROXY_FACTORY_ADDRESS = config.proxyFactory;
    }

    /**
     * @dev Compute ERC-4337 initCode for a new Safe with the Safe4337Module.
     * @notice CHANGES TO THIS FUNCTION SHOULD BE MIRRORED IN THE README!
     */
    function getInitCode(address[] memory owners, uint256 threshold, uint256 saltNonce) external view returns (bytes memory) {
        /** Setup Safe **/
        address[] memory modules = new address[](1);
        {
            modules[0] = SAFE_4337_MODULE_ADDRESS;
        }
        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256,address,bytes,address,address,uint256,address)",
            owners,
            threshold,
            SAFE_MODULE_SETUP_ADDRESS,
            abi.encodeWithSignature("enableModules(address[])", modules),
            SAFE_4337_MODULE_ADDRESS,
            // We do not want to use any refund logic; therefore, this is all set to 0
            address(0),
            0,
            address(0)
        );

        /** Deploy Proxy **/
        bytes memory initCallData = abi.encodeWithSignature(
            "createProxyWithNonce(address,bytes,uint256)",
            SAFE_SINGLETON_ADDRESS,
            initializer,
            saltNonce
        );

        /** Encode for 4337 **/
        bytes memory initCode = abi.encodePacked(SAFE_PROXY_FACTORY_ADDRESS, initCallData);

        return initCode;
    }
}
