// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Sorteio} from "../src/Sorteio.sol";

/// @notice Parte 1 do workshop: o sorteio "funciona"... mas é previsível.
contract SorteioTest is Test {
    Sorteio sorteio;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        sorteio = new Sorteio();
        address[3] memory pessoas = [alice, bob, carol];
        for (uint256 i; i < pessoas.length; i++) {
            vm.deal(pessoas[i], 1 ether);
            vm.prank(pessoas[i]);
            sorteio.entrar{value: 0.1 ether}();
        }
    }

    function test_sorteio_paga_o_vencedor() public {
        sorteio.sortear();
        address vencedor = sorteio.ultimoVencedor();
        assertEq(vencedor.balance, 0.9 ether + 0.3 ether);
        assertEq(address(sorteio).balance, 0);
        assertEq(sorteio.totalJogadores(), 0);
    }

    /// @notice Qualquer um consegue saber o vencedor ANTES de chamar sortear().
    function test_vencedor_e_previsivel() public {
        uint256 n = sorteio.totalJogadores();
        uint256 aleatorio = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, n)));
        address previsto = sorteio.jogadores(aleatorio % n);
        console.log("Vencedor previsto:", previsto);

        sorteio.sortear();

        assertEq(sorteio.ultimoVencedor(), previsto);
    }
}
