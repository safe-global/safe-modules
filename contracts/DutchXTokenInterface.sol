pragma solidity ^0.5.0;

// @title DutchX Token Interface - Represents the allowed methods of ERC20 token contracts to be executed from the safe module DutchXModule
/// @author Denis Granha - <denis@gnosis.pm>
interface DutchXTokenInterface {
	function transfer(address to, uint value) external;
    function approve(address spender, uint amount) external;
    function deposit() external payable;
    function withdraw() external;
}