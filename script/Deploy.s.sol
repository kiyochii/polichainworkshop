// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Sorteio} from "../src/Sorteio.sol";

/// @notice Deploy do Sorteio.
///   forge script script/Deploy.s.sol --rpc-url sepolia --account deployer --broadcast --verify
contract DeploySorteio is Script {
    function run() external returns (Sorteio sorteio) {
        vm.startBroadcast();
        sorteio = new Sorteio();
        vm.stopBroadcast();

        console.log("Sorteio implantado em:", address(sorteio));
        console.log("Chain id:", block.chainid);
    }
}
