// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Sorteio — VULNERÁVEL DE PROPÓSITO (material de workshop)
/// @notice NÃO USE EM PRODUÇÃO. A "aleatoriedade" vem de dados do bloco,
///         que são públicos e iguais para qualquer contrato executado no mesmo bloco.
contract Sorteio {
    uint256 public constant PRECO_BILHETE = 0.1 ether;
    uint256 public constant MIN_JOGADORES = 3;

    address[] public jogadores;
    uint256 public rodada;
    address public ultimoVencedor;

    event Entrou(address indexed jogador, uint256 indexed rodada);
    event Sorteado(address indexed vencedor, uint256 premio, uint256 indexed rodada);

    function entrar() external payable {
        require(msg.value == PRECO_BILHETE, "valor incorreto");
        jogadores.push(msg.sender);
        emit Entrou(msg.sender, rodada);
    }

    /// @notice Qualquer um pode encerrar a rodada assim que houver jogadores suficientes.
    function sortear() external {
        require(jogadores.length >= MIN_JOGADORES, "jogadores insuficientes");

        // VULNERABILIDADE (SWC-120): block.timestamp, block.prevrandao e
        // jogadores.length são conhecidos por qualquer contrato no mesmo bloco.
        uint256 aleatorio = uint256(
            keccak256(abi.encodePacked(block.timestamp, block.prevrandao, jogadores.length))
        );
        address vencedor = jogadores[aleatorio % jogadores.length];

        uint256 premio = address(this).balance;
        emit Sorteado(vencedor, premio, rodada);

        delete jogadores;
        rodada++;
        ultimoVencedor = vencedor;

        (bool ok, ) = vencedor.call{value: premio}("");
        require(ok, "falha no pagamento");
    }

    function totalJogadores() external view returns (uint256) {
        return jogadores.length;
    }
}
