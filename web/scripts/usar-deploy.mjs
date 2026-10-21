// Lê o último broadcast do Foundry e grava endereço + bloco do Sorteio em web/.env.local.
//   npm run usar-deploy             -> Sepolia (11155111)
//   npm run usar-deploy -- 84532    -> outra rede
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const chainId = process.argv[2] ?? "11155111";
const broadcast = fileURLToPath(
  new URL(`../../broadcast/Deploy.s.sol/${chainId}/run-latest.json`, import.meta.url),
);
const envLocal = fileURLToPath(new URL("../.env.local", import.meta.url));

if (!existsSync(broadcast)) {
  console.error(`Broadcast não encontrado: ${broadcast}\nRode o forge script com --broadcast antes.`);
  process.exit(1);
}

const run = JSON.parse(readFileSync(broadcast, "utf8"));
const tx = run.transactions.find((t) => t.contractName === "Sorteio" && t.transactionType === "CREATE");
const recibo = run.receipts.find((r) => r.transactionHash === tx?.hash);
if (!tx || !recibo) {
  console.error("Nenhum deploy do Sorteio encontrado no broadcast.");
  process.exit(1);
}

const novos = {
  VITE_CHAIN_ID: chainId,
  VITE_SORTEIO_ADDRESS: tx.contractAddress,
  VITE_DEPLOY_BLOCK: String(BigInt(recibo.blockNumber)),
};

// Mantém outras variáveis (ex.: VITE_RPC_URL) que já estiverem no arquivo.
const linhas = existsSync(envLocal) ? readFileSync(envLocal, "utf8").split("\n") : [];
const restantes = linhas.filter((l) => l.trim() && !Object.keys(novos).some((k) => l.startsWith(`${k}=`)));
writeFileSync(envLocal, [...restantes, ...Object.entries(novos).map(([k, v]) => `${k}=${v}`)].join("\n") + "\n");

console.log(`web/.env.local atualizado:`, novos);
