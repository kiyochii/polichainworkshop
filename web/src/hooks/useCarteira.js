import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, getAddress } from "viem";
import { rede } from "../config.js";

const provedor = typeof window !== "undefined" ? window.ethereum : undefined;

/** Conexão com a MetaMask (ou outra carteira injetada em window.ethereum). */
export function useCarteira() {
  const [conta, setConta] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [conectando, setConectando] = useState(false);

  const carteira = useMemo(
    () => (provedor ? createWalletClient({ chain: rede, transport: custom(provedor) }) : null),
    [],
  );

  useEffect(() => {
    if (!provedor) return;
    const aoTrocarContas = (contas) => setConta(contas[0] ? getAddress(contas[0]) : null);
    const aoTrocarRede = (id) => setChainId(Number(id));

    // Restaura a sessão sem abrir popup (eth_accounts só retorna se já houver permissão).
    provedor.request({ method: "eth_accounts" }).then(aoTrocarContas).catch(() => {});
    provedor.request({ method: "eth_chainId" }).then(aoTrocarRede).catch(() => {});

    provedor.on?.("accountsChanged", aoTrocarContas);
    provedor.on?.("chainChanged", aoTrocarRede);
    return () => {
      provedor.removeListener?.("accountsChanged", aoTrocarContas);
      provedor.removeListener?.("chainChanged", aoTrocarRede);
    };
  }, []);

  const conectar = useCallback(async () => {
    if (!carteira) return;
    setConectando(true);
    try {
      const [primeira] = await carteira.requestAddresses();
      setConta(primeira ?? null);
      setChainId(await carteira.getChainId());
    } finally {
      setConectando(false);
    }
  }, [carteira]);

  const trocarRede = useCallback(async () => {
    try {
      await carteira.switchChain({ id: rede.id });
    } catch (e) {
      // 4001 = usuário recusou. Qualquer outro erro geralmente é "rede desconhecida": adiciona.
      if (e?.code === 4001 || e?.cause?.code === 4001) throw e;
      await carteira.addChain({ chain: rede });
    }
  }, [carteira]);

  return {
    temCarteira: !!provedor,
    carteira,
    conta,
    conectado: !!conta,
    redeCorreta: chainId === rede.id,
    conectando,
    conectar,
    trocarRede,
  };
}
