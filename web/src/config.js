import { createPublicClient, http, isAddress, formatEther } from "viem";
import { sepolia, holesky, baseSepolia, arbitrumSepolia, optimismSepolia, foundry } from "viem/chains";
import artefato from "./contracts/Sorteio.json";

export const { abi, bytecode } = artefato;

const REDES = [sepolia, holesky, baseSepolia, arbitrumSepolia, optimismSepolia, foundry];
const env = import.meta.env;

export const rede = REDES.find((c) => c.id === Number(env.VITE_CHAIN_ID || sepolia.id)) ?? sepolia;
export const moeda = rede.nativeCurrency.symbol;
const explorer = rede.blockExplorers?.default.url;

export const publico = createPublicClient({
  chain: rede,
  transport: http(env.VITE_RPC_URL || undefined),
  pollingInterval: 4000,
});

// Endereço do contrato: .env tem prioridade; senão, o que foi implantado por esta tela (localStorage).
const CHAVE = `sorteio:${rede.id}`;

function lerLocal() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) ?? {};
  } catch {
    return {};
  }
}

export function contratoConfigurado() {
  if (isAddress(env.VITE_SORTEIO_ADDRESS ?? "")) {
    return {
      endereco: env.VITE_SORTEIO_ADDRESS,
      blocoDeploy: env.VITE_DEPLOY_BLOCK ? BigInt(env.VITE_DEPLOY_BLOCK) : null,
      origem: "env",
    };
  }
  const local = lerLocal();
  if (isAddress(local.endereco ?? "")) {
    return { endereco: local.endereco, blocoDeploy: local.bloco ? BigInt(local.bloco) : null, origem: "local" };
  }
  return null;
}

export function salvarContratoLocal(endereco, bloco) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ endereco, bloco: bloco?.toString() ?? null }));
  } catch {
    /* sem storage: o usuário precisa configurar o .env */
  }
}

export function esquecerContratoLocal() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}

export const linkTx = (hash) => (explorer ? `${explorer}/tx/${hash}` : null);
export const linkEndereco = (end) => (explorer ? `${explorer}/address/${end}` : null);

export const curto = (end) => (end ? `${end.slice(0, 6)}…${end.slice(-4)}` : "—");
export const valor = (wei) =>
  `${Number(formatEther(wei ?? 0n)).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} ${moeda}`;
export const mesmoEndereco = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const erroLegivel = (e) => e?.shortMessage ?? e?.message ?? String(e);
