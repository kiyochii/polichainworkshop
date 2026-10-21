// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Sorteio} from "./Sorteio.sol";

/// @title Atacante — EXERCÍCIO
/// @notice Objetivo: ganhar o Sorteio com 100% de certeza.
///         Rode `forge test --match-contract ExploitTest -vv` até passar.
contract Atacante {
    Sorteio public immutable alvo;
    address public immutable dono;

    constructor(Sorteio _alvo) {
        alvo = _alvo;
        dono = msg.sender;
    }

    /// @notice Deve ser chamada com exatamente 1 bilhete (0.1 ether).
    ///         Se neste bloco não dá para ganhar, a função deve REVERTER
    ///         (o atacante só perde gas e tenta de novo no próximo bloco).
    function atacar() external payable {
        require(msg.sender == dono, "so o dono");

        // TODO 1: quantos jogadores existirão depois que você entrar?
        // TODO 2: recalcule o MESMO número "aleatório" que o Sorteio vai calcular.
        // TODO 3: em qual índice você vai cair? Se não for o vencedor, reverta.
        // TODO 4: entre e chame sortear() — na mesma transação.

        revert("nao implementado");
    }

    function sacar() external {
        require(msg.sender == dono, "so o dono");
        (bool ok, ) = dono.call{value: address(this).balance}("");
        require(ok);
    }

    receive() external payable {}
}
