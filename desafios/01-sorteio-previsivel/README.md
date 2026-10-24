# Desafio 01: Sorteio previsível (Insecure Randomness)

> ⚠️ Os contratos deste desafio são **vulneráveis de propósito**. Não faça deploy em mainnet.

**Público:** intermediário (já escreveu Solidity básico) · **Duração sugerida:** ~90 min · **Ferramenta:** Foundry

## Estrutura

```
desafios/01-sorteio-previsivel/
├── src/Sorteio.sol        # o sorteio vulnerável (alvo)
├── src/Atacante.sol       # esqueleto do exercício (TODOs)
├── test/Sorteio.t.sol     # Parte 1: fluxo normal + prova de que o vencedor é previsível
├── test/Exploit.t.sol     # Parte 2: passa quando o Atacante estiver certo
├── script/Deploy.s.sol    # deploy do Sorteio (XRPL EVM Testnet, Sepolia, Anvil)
├── solucao/Atacante.sol   # solução — NÃO distribuir antes do exercício
├── web/                   # dApp React do sorteio (veja web/README.md)
└── writeup.md             # writeup completo do desafio (spoiler!)
```

Todos os comandos `forge` abaixo rodam **dentro desta pasta**.

## Setup dos participantes (fazer antes do dia)

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
git clone <repo> && cd <repo>/desafios/01-sorteio-previsivel
forge build
forge test   # esperado: Sorteio passa, Exploit FALHA
```

> Dica: publique o repositório **sem** a pasta `solucao/` e o `writeup.md` (ou numa branch separada).

---

## Roteiro

### 1. Contexto (10 min)
- Por que a blockchain é **determinística**: todo nó precisa reexecutar a transação e chegar ao mesmo resultado → não existe `random()` nativo.
- Fontes "tentadoras" e por que todas falham:

| Fonte | Problema |
|---|---|
| `block.timestamp` | Público; validador tem margem de manipulação |
| `block.prevrandao` (ex-`difficulty`) | Igual para todos os contratos no mesmo bloco; o proponente do bloco conhece antes |
| `blockhash(block.number)` | Sempre retorna `0` (bloco atual ainda não tem hash) |
| `blockhash(block.number - 1)` | Público para qualquer um no bloco atual |
| `msg.sender`, `jogadores.length`, nonce | Controlados ou conhecidos pelo atacante |

- Casos reais: SmartBillions (2017), Fomo3D/airdrop (2018), diversas loterias em BSC. Referência: **SWC-120**.

### 2. Apresentar o contrato (10 min)
Ler `src/Sorteio.sol` juntos. Perguntar à turma: *"Onde está o problema?"* antes de revelar.

Pontos-chave:
- `sortear()` é público — qualquer um escolhe **quando** sortear.
- A semente usa só valores que qualquer contrato lê no mesmo bloco.

### 3. Demo: o vencedor é previsível (10 min)
```bash
forge test --match-test test_vencedor_e_previsivel -vv
```
O teste calcula o vencedor **antes** de chamar `sortear()` e acerta. Se um teste consegue, um contrato também consegue.

### 4. Exercício: escrever o ataque (30 min)
Os participantes implementam `src/Atacante.sol` seguindo os TODOs e rodam:
```bash
forge test --match-contract ExploitTest -vv
```

**Dicas progressivas** (liberar a cada ~10 min):
1. Um contrato que chama outro executa no **mesmo bloco** → `block.timestamp` e `block.prevrandao` são idênticos.
2. Depois que você entrar, `jogadores.length` vira `n + 1` e você estará no último índice.
3. Se a conta não favorece você, `revert` — você só perde gas e tenta no próximo bloco (o teste simula isso com `vm.roll`/`vm.prevrandao`).

Ao final, mostrar `solucao/Atacante.sol`. Para validar: `cp solucao/Atacante.sol src/Atacante.sol` e trocar o import para `"./Sorteio.sol"`.

### 5. Mitigação (20 min)

**a) Chainlink VRF (recomendado)** — aleatoriedade com prova criptográfica, entregue em uma transação **posterior**:

```solidity
// npm/forge install smartcontractkit/chainlink-brownie-contracts
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

function sortear() external {
    require(jogadores.length >= MIN_JOGADORES, "jogadores insuficientes");
    require(!sorteando, "ja sorteando");
    sorteando = true; // bloqueia entrar() até o resultado chegar!
    s_vrfCoordinator.requestRandomWords(VRFV2PlusClient.RandomWordsRequest({
        keyHash: keyHash,
        subId: subId,
        requestConfirmations: 3,
        callbackGasLimit: 200_000,
        numWords: 1,
        extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
    }));
}

function fulfillRandomWords(uint256, uint256[] calldata palavras) internal override {
    address vencedor = jogadores[palavras[0] % jogadores.length];
    // ... pagar, resetar, sorteando = false
}
```

Pergunta para a turma: *por que `sorteando = true` é essencial?* (sem isso, o atacante vê o número no mempool e entra antes do callback).

**b) Commit-reveal** — cada jogador envia `keccak256(segredo)` e revela depois. Discutir a fraqueza: o **último a revelar** pode desistir se o resultado não o favorecer → exige depósito/penalidade.

**c) O que NÃO resolve:** bloquear contratos com `require(msg.sender == tx.origin)` ou `extcodesize == 0`. Um bot off-chain (ou o próprio validador) ainda prevê o resultado.

### 6. Encerramento (10 min)
- Regra de ouro: **se a fonte de aleatoriedade é legível on-chain no momento do uso, ela é previsível.**
- Bônus para casa: o `Sorteio` tem outra falha — se o vencedor for um contrato que rejeita ETH, `sortear()` reverte para sempre (DoS). Como corrigir? (padrão *pull payment*).

## Comandos úteis

```bash
forge test                                    # todos os testes
forge test --match-contract ExploitTest -vvvv # trace completo do ataque
```
