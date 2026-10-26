# Ataque on-chain ao Sorteio (XRPL EVM Testnet)

Demonstração ao vivo: um contrato atacante **sempre ganha** o `Sorteio`, porque a
"aleatoriedade" vem de dados do bloco (`block.timestamp`, `block.prevrandao`,
`jogadores.length`) que qualquer contrato lê no mesmo bloco. Na XRPL EVM o
`block.prevrandao` é sempre `0`, então o resultado é ainda mais previsível.

> ⚠️ Só na **testnet**. Contrato vulnerável de propósito (material de workshop).

## Arquivos

| Arquivo | O que é |
|---|---|
| `script/AtacanteLive.sol` | O contrato atacante (isolado; não toca no exercício `src/Atacante.sol`). |
| `script/ataque-testnet.sh` | Orquestra tudo: vítimas entram, deploy do atacante e loop de ataque. |

## Como o ataque funciona

`atacar()` roda numa única transação, logo num único bloco:

1. Calcula `n = totalJogadores() + 1` — depois de entrar, o atacante é o **último** da lista (índice `n-1`).
2. Recalcula a **mesma** semente que `sortear()` vai usar: `keccak256(timestamp, prevrandao, n)`.
3. Se `semente % n != n-1`, dá `revert` — o atacante só perde gas e tenta no próximo bloco.
4. Se favorece, chama `entrar()` e `sortear()` **atomicamente** → o atacante ganha o prêmio.

Como `entrar()` e `sortear()` acontecem na mesma transação, o atacante lê os dados do
bloco e age sobre eles no mesmo instante — nenhum "honesto" consegue reagir.

## Pré-requisitos

- [Foundry](https://book.getfoundry.sh/getting-started/installation) instalado.
- `jq` instalado (`brew install jq`).
- Carteira de teste `deployer` importada e com XRP do faucet:

  ```bash
  cast wallet import deployer --interactive      # cole a chave de uma carteira de TESTE
  cast wallet address --account deployer         # pegue XRP em https://faucet.xrplevm.org
  ```

  > O script assume keystore com **senha vazia**. Se a sua tem senha, edite a
  > variável `SENHA` no topo de `script/ataque-testnet.sh`.

## Executar

A partir da pasta deste desafio (`desafios/01-sorteio-previsivel/`):

```bash
cd desafios/01-sorteio-previsivel
chmod +x script/ataque-testnet.sh
./script/ataque-testnet.sh
```

Saída esperada (resumida):

```
>> 2 jogadores honestos entram (0.1 XRP cada)
>> deploy do atacante
   Atacante: 0x...
>> atacando até ganhar (revert = não é a nossa vez)
   tentativa 1: não foi a vez, próximo bloco...
   tentativa 2: GANHOU 🎉
>> último vencedor: 0x...  (deve ser o atacante)
>> sacando o prêmio para o dono
```

Com `prevrandao = 0` e 3 jogadores, a chance é ~1/3 por bloco → costuma ganhar em poucas tentativas.

## Variáveis (opcionais)

| Variável | Para quê |
|---|---|
| `SORTEIO` | Endereço do contrato. Padrão: o já implantado (`0xe819…B781`). |
| `PULAR_HONESTOS=1` | **Não** cria jogadores honestos. Use quando a turma já entrou pelo site — o atacante rouba o prêmio real deles. |
| `TENTATIVAS` | Nº de blocos a tentar antes de desistir (padrão 60). |

Exemplos:

```bash
# Contra um Sorteio recém-implantado por você:
SORTEIO=0xSEU_CONTRATO ./script/ataque-testnet.sh

# A turma já comprou bilhetes pelo site; o instrutor só dá o golpe:
PULAR_HONESTOS=1 ./script/ataque-testnet.sh
```

## Roteiro sugerido para a aula

1. Faça deploy de um `Sorteio` novo (ou use o do site) e mostre o fluxo normal: alunos
   compram bilhetes em http://localhost:5173.
2. Rode `PULAR_HONESTOS=1 ./script/ataque-testnet.sh` e mostre o atacante ganhando.
3. Abra o link do explorer no fim e mostre a transação `entrar` + `sortear` na mesma tx.
4. Discuta a correção: Chainlink VRF (aleatoriedade entregue numa transação **posterior**).

> Nota: se você rodar **sem** `PULAR_HONESTOS`, as "vítimas" são a própria conta
> `deployer`, então o lucro líquido é zero — serve só para ver a mecânica. O lucro
> real aparece quando as vítimas são outras carteiras (os alunos pelo site).
