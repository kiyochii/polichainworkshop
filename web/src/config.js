import { createPublicClient, http, isAddress, formatEther } from "viem";
import { xrplevmTestnet, sepolia, holesky, baseSepolia, arbitrumSepolia, optimismSepolia, foundry } from "viem/chains";
import artefato from "./contracts/Sorteio.json";

export const { abi, bytecode } = artefato;

const REDES = [xrplevmTestnet, sepolia, holesky, baseSepolia, arbitrumSepolia, optimismSepolia, foundry];
const env = import.meta.env;

export const rede = REDES.find((c) => c.id === Number(env.VITE_CHAIN_ID || xrplevmTestnet.id)) ?? xrplevmTestnet;
export const moeda = rede.nativeCurrency.symbol;
const explorer = rede.blockExplorers?.default.url;

const FAUCETS = {
  [xrplevmTestnet.id]: "https://faucet.xrplevm.org",
  [sepolia.id]: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
};
export const faucet = FAUCETS[rede.id] ?? null;

// Nome do endpoint em foundry.toml e flags de verificação, usados nas instruções de deploy.
const FORGE = {
  [xrplevmTestnet.id]: {
    rpc: "xrpl_testnet",
    verificar: "--verify --verifier blockscout --verifier-url https://explorer.testnet.xrplevm.org/api/",
  },
  [sepolia.id]: { rpc: "sepolia", verificar: "--verify" },
  [foundry.id]: { rpc: "anvil", verificar: "" },
};
export const forge = FORGE[rede.id] ?? { rpc: "<rpc-da-rede>", verificar: "" };

export const publico = createPublicClient({
  chain: rede,
  transport: http(env.VITE_RPC_URL || undefined),
  pollingInterval: 4000,
  // Agrupa as leituras do painel num único eth_call (o RPC público da XRPL EVM recusa rajadas paralelas).
  batch: rede.contracts?.multicall3 ? { multicall: true } : undefined,
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
