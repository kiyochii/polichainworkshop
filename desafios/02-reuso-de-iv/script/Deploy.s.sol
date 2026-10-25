// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MuralSecreto} from "../src/MuralSecreto.sol";

/// @notice Deploy do MuralSecreto.
///   forge script script/Deploy.s.sol --rpc-url xrpl_testnet --account deployer --broadcast \
///     --verify --verifier blockscout --verifier-url https://explorer.testnet.xrplevm.org/api/
contract DeployMuralSecreto is Script {
    function run() external returns (MuralSecreto mural) {
        bytes32 chave = keccak256("troque esta chave antes de usar");
        bytes memory segredo = bytes("PARABENS{reuso_de_iv_e_two_time_pad}");

        vm.startBroadcast();
        mural = new MuralSecreto(chave, segredo);
        vm.stopBroadcast();

        console.log("MuralSecreto implantado em:", address(mural));
        console.log("Chain id:", block.chainid);
        console.log("IV da nota:", mural.ivNota());
    }
}
