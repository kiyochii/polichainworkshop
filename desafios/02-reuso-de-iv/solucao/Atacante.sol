// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MuralSecreto} from "../src/MuralSecreto.sol";

/// @title Atacante — SOLUÇÃO (não distribuir antes do exercício)
/// @notice Recupera o segredo explorando o REUSO DE IV (two-time pad), sem a chave.
contract Atacante {
    MuralSecreto public immutable alvo;
    address public immutable dono;

    constructor(MuralSecreto _alvo) {
        alvo = _alvo;
        dono = msg.sender;
    }

    function recuperarSegredo() external returns (bytes memory segredo) {
        // 1. O texto cifrado do segredo é público (é só estado on-chain).
        bytes memory nota = alvo.notaSecreta();
        uint256 n = nota.length;

        // 2. Publicamos um texto conhecido do mesmo tamanho. Escolhemos TUDO ZERO:
        //    como 0 ^ ks = ks, o "cifrado" devolvido É o keystream da época atual.
        //    Estamos na mesma época da nota → MESMO IV → MESMO keystream.
        bytes memory conhecido = new bytes(n); // n bytes 0x00
        (bytes memory cifradoConhecido, ) = alvo.publicar(conhecido);

        // 3. keystream = cifrado(conhecido) XOR conhecido  (= cifrado, já que conhecido é zero).
        //    Mantemos o XOR explícito para valer com qualquer texto conhecido.
        segredo = new bytes(n);
        for (uint256 i; i < n; i++) {
            bytes1 ks = cifradoConhecido[i] ^ conhecido[i];
            // 4. segredo = notaSecreta XOR keystream.
            segredo[i] = nota[i] ^ ks;
        }
    }
}
