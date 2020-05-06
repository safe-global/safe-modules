pragma solidity >=0.4.21 <0.6.0;

import "@gnosis.pm/util-contracts/contracts/GnosisStandardToken.sol";

contract TestToken is GnosisStandardToken{
    constructor() public {
        balances[msg.sender] = 10000000;
    }
}