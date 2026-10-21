# Sorteio: dApp (React + Vite + viem + MetaMask)

Interface do contrato `src/Sorteio.sol`: comprar bilhete, ver participantes, realizar o sorteio e ver os
últimos vencedores. Conecta com a MetaMask e troca/adiciona a rede automaticamente.

> ⚠️ O contrato é vulnerável de propósito (material de workshop). Use **somente em testnet**.

## 1. Deploy do contrato na Sepolia (Foundry)

Pré-requisitos: [Foundry](https://book.getfoundry.sh/getting-started/installation), uma URL de RPC da Sepolia
(Alchemy/Infura) e ETH de testnet numa carteira (faucets: Google Cloud Web3, Alchemy, Infura).

```bash
# na raiz do projeto
cp .env.example .env                       # preencha SEPOLIA_RPC_URL e (opcional) ETHERSCAN_API_KEY
cast wallet import deployer --interactive  # cole a chave privada da carteira de TESTE (fica criptografada)

forge script script/Deploy.s.sol --rpc-url sepolia --account deployer --broadcast --verify
# sem chave do Etherscan, tire o --verify
```

## 2. Apontar o site para o contrato

```bash
cd web
npm install
npm run usar-deploy        # lê broadcast/Deploy.s.sol/11155111/run-latest.json e grava web/.env.local
npm run dev                # http://localhost:5173
```

Ou preencha manualmente `web/.env.local` (veja `web/.env.example`):

| Variável | Para quê |
|---|---|
| `VITE_CHAIN_ID` | Rede (padrão `11155111` = Sepolia). Também: Holesky, Base/Arbitrum/OP Sepolia, `31337` Anvil |
| `VITE_SORTEIO_ADDRESS` | Endereço do contrato |
| `VITE_DEPLOY_BLOCK` | Bloco do deploy (histórico de vencedores) |
| `VITE_RPC_URL` | RPC de leitura (opcional, recomendado; RPCs públicos limitam `eth_getLogs`) |

Sem `VITE_SORTEIO_ADDRESS`, o site mostra uma tela de configuração que permite **fazer o deploy pela própria
MetaMask** ou colar o endereço de um contrato existente (salvo só no seu navegador).

## 3. Publicar o site

```bash
npm run build              # gera web/dist (site estático)
```

Publique `web/dist` em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages, Cloudflare Pages).
Na Vercel/Netlify: diretório raiz `web`, build `npm run build`, saída `dist`, e cadastre as variáveis `VITE_*`
no painel (elas são embutidas no build).

## Outras redes

Para outra testnet, adicione o endpoint em `foundry.toml` (`[rpc_endpoints]`), faça o deploy com
`--rpc-url <nome>` e rode `npm run usar-deploy -- <chainId>`.

## Teste local com Anvil

```bash
anvil                                                       # terminal 1
forge script script/Deploy.s.sol --rpc-url anvil --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
cd web && npm run usar-deploy -- 31337 && npm run dev
```

Na MetaMask, importe uma das contas do Anvil (a chave aparece no terminal dele).
