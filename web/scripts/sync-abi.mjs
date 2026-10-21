// Copia ABI + bytecode do artefato do Foundry (../out) para o front-end.
// Rode `forge build` na raiz antes, se tiver alterado o contrato.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const origem = fileURLToPath(new URL("../../out/Sorteio.sol/Sorteio.json", import.meta.url));
const destino = fileURLToPath(new URL("../src/contracts/Sorteio.json", import.meta.url));

if (!existsSync(origem)) {
  console.warn(`[sync-abi] ${origem} não encontrado — usando a cópia existente em src/contracts.`);
  process.exit(0);
}

const artefato = JSON.parse(readFileSync(origem, "utf8"));
writeFileSync(
  destino,
  JSON.stringify({ abi: artefato.abi, bytecode: artefato.bytecode.object }, null, 2) + "\n",
);
console.log("[sync-abi] src/contracts/Sorteio.json atualizado");
