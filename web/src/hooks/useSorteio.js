import { useCallback, useEffect, useState } from "react";
import { parseEventLogs } from "viem";
import { abi, publico } from "../config.js";

const EVENTO_SORTEADO = abi.find((x) => x.type === "event" && x.name === "Sorteado");
// Muitos RPCs gratuitos limitam o intervalo do eth_getLogs; nesse caso olhamos só os blocos recentes.
const JANELA_RECENTE = 499n;

function paraSorteio(log) {
  return {
    vencedor: log.args.vencedor,
    premio: log.args.premio,
    rodada: Number(log.args.rodada),
    hash: log.transactionHash,
    bloco: log.blockNumber,
  };
}

/** Estado do contrato Sorteio, atualizado periodicamente. */
export function useSorteio(endereco, blocoDeploy) {
  const [estado, setEstado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [erro, setErro] = useState(null);

  const ler = useCallback(
    (functionName, args = []) => publico.readContract({ address: endereco, abi, functionName, args }),
    [endereco],
  );

  const atualizar = useCallback(async () => {
    try {
      const [total, rodada, ultimoVencedor, premio, preco, minimo] = await Promise.all([
        ler("totalJogadores"),
        ler("rodada"),
        ler("ultimoVencedor"),
        publico.getBalance({ address: endereco }),
        ler("PRECO_BILHETE"),
        ler("MIN_JOGADORES"),
      ]);
      const jogadores = await Promise.all(Array.from({ length: Number(total) }, (_, i) => ler("jogadores", [BigInt(i)])));
      setEstado({ jogadores, rodada: Number(rodada), ultimoVencedor, premio, preco, minimo: Number(minimo) });
      setErro(null);
    } catch (e) {
      setErro(e);
    }
  }, [endereco, ler]);

  const carregarHistorico = useCallback(async () => {
    const buscar = (fromBlock) => publico.getLogs({ address: endereco, event: EVENTO_SORTEADO, fromBlock });
    let logs;
    try {
      logs = await buscar(blocoDeploy ?? 0n);
    } catch {
      try {
        const atual = await publico.getBlockNumber();
        logs = await buscar(atual > JANELA_RECENTE ? atual - JANELA_RECENTE : 0n);
      } catch {
        return;
      }
    }
    setHistorico((anterior) => mesclar(anterior, logs.map(paraSorteio)));
  }, [endereco, blocoDeploy]);

  /** Registra o resultado de um sortear() a partir do recibo, sem esperar o próximo getLogs. */
  const registrarRecibo = useCallback((recibo) => {
    const logs = parseEventLogs({ abi, eventName: "Sorteado", logs: recibo.logs });
    setHistorico((anterior) => mesclar(anterior, logs.map(paraSorteio)));
    return logs[0] ? paraSorteio(logs[0]) : null;
  }, []);

  useEffect(() => {
    setEstado(null);
    setHistorico([]);
    atualizar();
    carregarHistorico();
    const id = setInterval(atualizar, 5000);
    return () => clearInterval(id);
  }, [atualizar, carregarHistorico]);

  return { estado, historico, erro, atualizar, registrarRecibo };
}

function mesclar(anterior, novos) {
  const porRodada = new Map(anterior.map((s) => [s.rodada, s]));
  for (const s of novos) porRodada.set(s.rodada, s);
  return [...porRodada.values()].sort((a, b) => b.rodada - a.rodada);
}
