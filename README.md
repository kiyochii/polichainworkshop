# Workshop Polichain: desafios de segurança em Solidity

> ⚠️ Todos os contratos deste repositório são **vulneráveis de propósito**. Use somente em testnet.

Cada desafio é independente e fica em `desafios/NN-nome/`, com contratos, testes, solução, site (dApp) e
writeup próprios. A biblioteca `forge-std` em `lib/` é compartilhada por todos.

## Desafios

| # | Desafio | Tema | Pasta |
|---|---|---|---|
| 01 | Sorteio previsível | Aleatoriedade insegura (SWC-120) | [`desafios/01-sorteio-previsivel`](desafios/01-sorteio-previsivel) |
| 02 | Mural secreto | Reuso de IV / two-time pad | [`desafios/02-reuso-de-iv`](desafios/02-reuso-de-iv) |

## Pré-requisitos

- [Foundry](https://book.getfoundry.sh/getting-started/installation): `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Node.js 18+ (para os sites)
- MetaMask (para usar os sites em testnet)

## Como rodar um desafio

```bash
cd desafios/01-sorteio-previsivel
forge test                       # contratos e testes do desafio

cd web
npm install
npm run usar-deploy              # grava web/.env.local com o contrato (precisa de um deploy feito, veja abaixo)
npm run dev                      # site do desafio em http://localhost:5173
```

O site só funciona depois do deploy do contrato: ele precisa do `web/.env.local` com o endereço. O passo a passo
do deploy (Foundry na XRPL EVM Testnet ou pela MetaMask), a solução de problemas e as variáveis ficam em
[`web/README.md`](desafios/01-sorteio-previsivel/web/README.md). Rode o `forge script` de dentro da pasta do
desafio, senão o broadcast não é encontrado pelo `usar-deploy`.

Cada pasta tem um `README.md` (roteiro do desafio e deploy) e um `writeup.md` (solução, com spoiler).

Testar todos os desafios de uma vez:

```bash
for d in desafios/*/; do (cd "$d" && forge test); done
```

## Estrutura

```
lib/forge-std/                  # dependência compartilhada
desafios/
└── NN-nome/
    ├── foundry.toml            # projeto Foundry do desafio (aponta para ../../lib)
    ├── src/                    # contrato(s) vulnerável(is) + esqueleto do exercício
    ├── test/                   # testes (fluxo normal + exploit)
    ├── script/                 # deploy (forge script)
    ├── solucao/                # solução: não distribuir antes do exercício
    ├── web/                    # dApp React + Vite + viem (opcional)
    ├── .env.example
    ├── README.md               # roteiro do desafio
    └── writeup.md              # writeup completo
```

## Criando um novo desafio

1. Crie `desafios/NN-nome/` (numeração com dois dígitos, nome em kebab-case).
2. Copie o `foundry.toml` do desafio 01. Ele já aponta `libs`/`remappings` para o `forge-std` da raiz.
3. Escreva o alvo em `src/`, os testes em `test/` (um que prova o fluxo normal e um que só passa com o
   exploit), a solução em `solucao/` e o deploy em `script/Deploy.s.sol`.
4. Opcional: copie `desafios/01-sorteio-previsivel/web/` como base do site. Os pontos a trocar são:
   - `scripts/sync-abi.mjs`: caminho do artefato (`out/<Contrato>.sol/<Contrato>.json`);
   - `src/config.js` e `src/hooks/`: ABI, leituras e eventos do novo contrato;
   - `scripts/usar-deploy.mjs`: nome do contrato procurado no broadcast (`contractName === "Sorteio"`);
   - `src/components/Painel.jsx`: a interface.
   A conexão com MetaMask (`useCarteira.js`), as redes (`config.js`) e as notificações já servem como estão.
5. Escreva o `README.md` (roteiro) e o `writeup.md` (solução) e adicione uma linha na tabela acima.
