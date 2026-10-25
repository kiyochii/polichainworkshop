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
        vm.roll(1_000);
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

    /// @notice O PONTO FRACO: o IV vem do endereço do dono → é CONSTANTE sempre.
    function test_iv_e_fixo_para_sempre() public {
        vm.roll(1_000);
        uint256 iv1 = mural.ivAtual();

        vm.roll(9_999_999); // muito tempo depois
        uint256 iv2 = mural.ivAtual();

        assertEq(iv1, iv2, "IV nao deveria mudar com o tempo (bug)");
        assertEq(iv1, mural.ivNota(), "e e o mesmo IV da nota secreta");
        assertEq(iv1, uint256(keccak256(abi.encodePacked(address(this)))), "IV = keccak(dono)");

        console.log("IV fixo (keccak do dono):", iv1);
    }

    /// @notice Publicar ZEROS devolve exatamente o keystream (IV fixo).
    function test_zeros_revelam_o_keystream() public {
        bytes memory zeros = new bytes(8);
        (bytes memory saida, uint256 iv) = mural.publicar(zeros);

        assertEq(iv, mural.ivNota(), "mesmo IV da nota");
        // saida == keystream: duas publicacoes de zeros sao sempre iguais (IV fixo).
        (bytes memory saida2, ) = mural.publicar(new bytes(8));
        assertEq(saida, saida2, "mesmo keystream para todo mundo");
    }
}
