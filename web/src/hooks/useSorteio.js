import { useCallback, useEffect, useState } from "react";
import { parseEventLogs } from "viem";
import { abi, publico } from "../config.js";

const EVENTO_SORTEADO = abi.find((x) => x.type === "event" && x.name === "Sorteado");
// RPCs costumam limitar o intervalo do eth_getLogs (o da XRPL EVM aceita ~10 mil blocos),
// então o histórico é buscado de trás para frente em janelas, uma por vez: o RPC público
// responde 502 a consultas paralelas.
const JANELA = 10_000n;
const MAX_JANELAS = 30; // com o bloco do deploy conhecido (~2 semanas na XRPL EVM)
const MAX_JANELAS_SEM_DEPLOY = 6;
const MAX_HISTORICO = 10;

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
    let ate;
    try {
      ate = await publico.getBlockNumber();
    } catch {
      return;
    }
    const inicio = blocoDeploy ?? 0n;
    const limite = blocoDeploy == null ? MAX_JANELAS_SEM_DEPLOY : MAX_JANELAS;
    let total = 0;
    for (let i = 0; i < limite && ate >= inicio && total < MAX_HISTORICO; i++, ate -= JANELA) {
      const de = ate - JANELA + 1n > inicio ? ate - JANELA + 1n : inicio;
      try {
        const logs = await publico.getLogs({ address: endereco, event: EVENTO_SORTEADO, fromBlock: de, toBlock: ate });
        total += logs.length;
        setHistorico((anterior) => mesclar(anterior, logs.map(paraSorteio)));
      } catch {
        /* janela com erro: segue para a próxima */
      }
    }
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
