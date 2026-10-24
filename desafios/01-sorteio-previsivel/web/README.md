# Sorteio: dApp (React + Vite + viem + MetaMask)

Interface do contrato `src/Sorteio.sol`: comprar bilhete, ver participantes, realizar o sorteio e ver os
últimos vencedores. Conecta com a MetaMask e troca/adiciona a rede automaticamente.

Rede padrão: **XRPL EVM Testnet** (sidechain EVM da XRP Ledger).

| | |
|---|---|
| Chain ID | `1449000` |
| RPC | `https://rpc.testnet.xrplevm.org` |
| Explorer | https://explorer.testnet.xrplevm.org (Blockscout) |
| Moeda | XRP (18 casas, como o ETH) |
| Faucet | https://faucet.xrplevm.org |

> ⚠️ O contrato é vulnerável de propósito (material de workshop). Use **somente em testnet**.
> Na XRPL EVM o `block.prevrandao` é sempre `0`, então o sorteio depende só de `block.timestamp` e do número de
> jogadores. Fica ainda mais previsível.

## 1. Carteira e XRP de teste

1. Abra o site e clique em **Conectar carteira**. Se a MetaMask estiver em outra rede, o botão
   "Trocar para XRPL EVM Testnet" adiciona a rede automaticamente.
2. Pegue XRP de teste em https://faucet.xrplevm.org (cole seu endereço `0x…`).

## 2. Deploy do contrato

### Opção A: Foundry (recomendado)

Pré-requisito: [Foundry](https://book.getfoundry.sh/getting-started/installation). Não precisa de `.env`:
o RPC da XRPL é público e a verificação usa o Blockscout, sem chave.

```bash
# na pasta do desafio: desafios/01-sorteio-previsivel
cast wallet import deployer --interactive   # chave privada de uma carteira de TESTE com XRP do faucet

forge script script/Deploy.s.sol --rpc-url xrpl_testnet --account deployer --broadcast \
  --verify --verifier blockscout --verifier-url https://explorer.testnet.xrplevm.org/api/

cd web
npm install
npm run usar-deploy        # lê broadcast/Deploy.s.sol/1449000/run-latest.json e grava web/.env.local
npm run dev                # http://localhost:5173
```

Se a verificação falhar, o contrato já está implantado. Dá para verificar depois com `forge verify-contract`,
ou simplesmente tirar as flags `--verify ...`.

### Opção B: pela MetaMask, sem instalar nada

Rode `npm install && npm run dev` em `web/` sem `VITE_SORTEIO_ADDRESS`: o site mostra uma tela de configuração
com o botão **Fazer deploy na XRPL EVM Testnet**. Depois, copie o endereço e o bloco exibidos para o
`web/.env.local` (veja abaixo). Sem isso, o endereço fica salvo só no seu navegador.

## 3. Variáveis do site (`web/.env.local`)

| Variável | Para quê |
|---|---|
| `VITE_CHAIN_ID` | Rede (padrão `1449000`). Também: `11155111` Sepolia, `17000` Holesky, `84532` Base Sepolia, `421614` Arbitrum Sepolia, `11155420` OP Sepolia, `31337` Anvil |
| `VITE_SORTEIO_ADDRESS` | Endereço do contrato |
| `VITE_DEPLOY_BLOCK` | Bloco do deploy (o histórico de vencedores busca eventos a partir dele) |
| `VITE_RPC_URL` | RPC de leitura (opcional; sem ele usa o público da rede) |

## 4. Publicar o site

```bash
npm run build              # gera web/dist (site estático)
```

Publique `web/dist` em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages, Cloudflare Pages).
Na Vercel/Netlify: diretório raiz `desafios/01-sorteio-previsivel/web`, build `npm run build`, saída `dist`, e cadastre as variáveis `VITE_*`
no painel (elas são embutidas no build).

## Outras redes

- **Sepolia:** descomente `sepolia` em `foundry.toml`, preencha o `.env` da pasta do desafio (veja `.env.example`), faça o
  deploy com `--rpc-url sepolia --verify` e rode `npm run usar-deploy -- 11155111`.
- **Anvil (local):**
  ```bash
  anvil                                                       # terminal 1
  forge script script/Deploy.s.sol --rpc-url anvil --broadcast \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  cd web && npm run usar-deploy -- 31337 && npm run dev
  ```
