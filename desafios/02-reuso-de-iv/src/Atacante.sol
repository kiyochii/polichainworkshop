// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MuralSecreto} from "./MuralSecreto.sol";

/// @title Atacante — EXERCÍCIO
/// @notice Objetivo: recuperar o texto em claro de `notaSecreta` SEM ter a chave.
///         Rode `forge test --match-contract ExploitTest -vv` até passar.
contract Atacante {
    MuralSecreto public immutable alvo;
    address public immutable dono;

    constructor(MuralSecreto _alvo) {
        alvo = _alvo;
        dono = msg.sender;
    }

    /// @notice Deve devolver o segredo em claro (os mesmos bytes que o dono cifrou).
    ///         Precisa rodar na MESMA época em que a nota foi cifrada (mesmo IV).
    function recuperarSegredo() external returns (bytes memory segredo) {
        // TODO 1: pegue o texto cifrado público `notaSecreta()` e o tamanho dele.
        // TODO 2: publique no mural um texto do MESMO tamanho cujo claro você
        //         conhece (dica: zeros revelam o keystream direto, pois 0 ^ ks = ks).
        // TODO 3: recupere o keystream (texto conhecido XOR texto cifrado devolvido).
        // TODO 4: segredo = notaSecreta XOR keystream.

        revert("nao implementado");
    }
}
