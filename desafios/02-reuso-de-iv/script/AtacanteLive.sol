// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MuralSecreto} from "../src/MuralSecreto.sol";

/// @title AtacanteLive — ataque AO VIVO ao reuso de IV (two-time pad).
/// @notice Mesma lógica de solucao/Atacante.sol, isolado aqui para NÃO tocar no
///         esqueleto do exercício (src/Atacante.sol). Recupera o segredo do dono
///         SEM a chave — só com a função pública `publicar` e o cifrado público —
///         e GRAVA o resultado on-chain (`segredoRecuperado`), como prova pública.
contract AtacanteLive {
    MuralSecreto public immutable alvo;
    address public immutable dono;

    /// @notice O segredo recuperado fica GRAVADO on-chain: qualquer um confere.
    bytes public segredoRecuperado;

    event SegredoRoubado(bytes segredo);

    constructor(MuralSecreto _alvo) {
        alvo = _alvo;
        dono = msg.sender;
    }

    /// @notice Recupera o texto em claro da nota do dono e o grava on-chain.
    function recuperar() external returns (bytes memory segredo) {
        // 1. O texto cifrado do segredo é público (é só estado on-chain).
        bytes memory nota = alvo.notaSecreta();
        uint256 n = nota.length;

        // 2. Publicamos um texto conhecido do mesmo tamanho: TUDO ZERO.
        //    Como 0 ^ ks = ks, o "cifrado" devolvido É o keystream da época atual.
        //    Mesma época da nota -> MESMO IV (keccak do dono) -> MESMO keystream.
        bytes memory conhecido = new bytes(n); // n bytes 0x00
        (bytes memory ksCifrado, ) = alvo.publicar(conhecido);

        // 3. keystream = cifrado(conhecido) XOR conhecido (= cifrado, pois é zero).
        //    4. segredo = notaSecreta XOR keystream.
        segredo = new bytes(n);
        for (uint256 i; i < n; i++) {
            bytes1 ks = ksCifrado[i] ^ conhecido[i];
            segredo[i] = nota[i] ^ ks;
        }

        segredoRecuperado = segredo; // prova gravada on-chain
        emit SegredoRoubado(segredo);
    }
}
