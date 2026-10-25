// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {MuralSecreto} from "../src/MuralSecreto.sol";

/// @notice Parte 1 do workshop: o mural "funciona"... mas o IV se repete.
contract MuralSecretoTest is Test {
    MuralSecreto mural;
    bytes32 chave = keccak256("chave mestra super secreta");
    bytes segredo = bytes("PARABENS{reuso_de_iv_e_two_time_pad}");

    function setUp() public {
        vm.roll(1_000); // bloco 1000 -> epoca = 1000 / 256 = 3
        mural = new MuralSecreto(chave, segredo);
    }

    /// @notice O dono consegue decifrar a própria nota com a chave correta.
    function test_dono_decifra_com_a_chave() public view {
        bytes memory claro = mural.revelarNota(chave);
        assertEq(claro, segredo, "deveria recuperar o segredo original");
    }

    /// @notice Sem a chave certa, revelarNota reverte.
    function test_chave_errada_reverte() public {
        vm.expectRevert(bytes("chave errada"));
        mural.revelarNota(keccak256("chute"));
    }

    /// @notice O PONTO FRACO: blocos diferentes da MESMA época dão o MESMO IV.
    function test_iv_se_repete_na_mesma_epoca() public {
        vm.roll(1_000);
        uint256 iv1 = mural.ivAtual();

        vm.roll(1_020); // mesma época: 768..1023 (1020 / 256 == 3)
        uint256 iv2 = mural.ivAtual();

        vm.roll(1_100); // 1100 / 256 == 4: época nova
        uint256 iv3 = mural.ivAtual();

        assertEq(iv1, iv2, "IV deveria se repetir dentro da epoca (bug)");
        assertEq(iv1, mural.ivNota(), "e e o mesmo IV da nota secreta");
        assertTrue(iv3 != iv1, "em outra epoca o IV muda");

        console.log("IV da nota (epoca 3):", iv1);
        console.log("IV em outra epoca (4):", iv3);
    }

    /// @notice Publicar ZEROS devolve exatamente o keystream daquela época.
    function test_zeros_revelam_o_keystream() public {
        bytes memory zeros = new bytes(8);
        (bytes memory saida, uint256 iv) = mural.publicar(zeros);

        assertEq(iv, mural.ivNota(), "mesmo IV da nota");
        // saida == keystream: duas publicacoes de zeros na mesma epoca sao iguais.
        (bytes memory saida2, ) = mural.publicar(new bytes(8));
        assertEq(saida, saida2, "mesmo keystream para todo mundo na epoca");
    }
}
