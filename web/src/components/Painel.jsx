import { abi, publico, rede, faucet, valor, curto, mesmoEndereco, linkEndereco, linkTx, erroLegivel } from "../config.js";
import { useSorteio } from "../hooks/useSorteio.js";

export default function Painel({ contrato, carteira, notificar }) {
  const { endereco, blocoDeploy } = contrato;
  const { estado, historico, erro, atualizar, registrarRecibo } = useSorteio(endereco, blocoDeploy);
  const { conta, conectado, redeCorreta, conectar, trocarRede } = carteira;

  if (!estado) {
    return (
      <div className="card centro">
        {erro ? (
          <p className="aviso aviso-erro">Não foi possível ler o contrato {curto(endereco)}: {erroLegivel(erro)}</p>
        ) : (
          <p className="apagado">Carregando sorteio…</p>
        )}
      </div>
    );
  }

  const { jogadores, rodada, premio, preco, minimo } = estado;
  const meus = jogadores.filter((j) => mesmoEndereco(j, conta)).length;
  const podeSortear = jogadores.length >= minimo;
  const pronto = conectado && redeCorreta;

  async function executar(titulo, functionName, opcoes = {}) {
    const id = notificar({ tipo: "info", titulo, texto: "Confirme na carteira…" });
    try {
      // Simula antes para mostrar o motivo de um revert sem gastar gas.
      const { request } = await publico.simulateContract({ address: endereco, abi, functionName, account: conta, ...opcoes });
      const hash = await carteira.carteira.writeContract(request);
      notificar({ id, tipo: "info", titulo, texto: "Transação enviada, aguardando confirmação…", hash });
      const recibo = await publico.waitForTransactionReceipt({ hash });
      if (recibo.status !== "success") throw new Error("a transação foi revertida");
      await atualizar();
      return { id, hash, recibo };
    } catch (e) {
      notificar({ id, tipo: "erro", titulo: `${titulo}: falhou`, texto: erroLegivel(e) });
      return null;
    }
  }

  async function comprar() {
    const r = await executar("Comprar bilhete", "entrar", { value: preco });
    if (r) notificar({ id: r.id, tipo: "ok", titulo: "Bilhete comprado!", texto: "Boa sorte 🍀", hash: r.hash });
  }

  async function sortear() {
    const r = await executar("Realizar sorteio", "sortear");
    if (!r) return;
    const resultado = registrarRecibo(r.recibo);
    const ganhei = mesmoEndereco(resultado?.vencedor, conta);
    notificar({
      id: r.id,
      tipo: "ok",
      titulo: ganhei ? "🎉 Você ganhou!" : "Sorteio realizado",
      texto: resultado ? `${ganhei ? "Você" : curto(resultado.vencedor)} levou ${valor(resultado.premio)}.` : null,
      hash: r.hash,
    });
  }

  const acaoPrincipal = !conectado ? (
    <button className="btn btn-primario btn-grande" onClick={conectar}>
      Conectar carteira para jogar
    </button>
  ) : !redeCorreta ? (
    <button className="btn btn-alerta btn-grande" onClick={() => trocarRede().catch(() => {})}>
      Trocar de rede
    </button>
  ) : (
    <button className="btn btn-primario btn-grande" onClick={comprar}>
      Comprar bilhete · {valor(preco)}
    </button>
  );

  return (
    <>
      <section className="destaque-rodada">
        <div className="destaque-info">
          <span className="rotulo">Rodada #{rodada} · prêmio acumulado</span>
          <strong className="premio">{valor(premio)}</strong>
          <div className="progresso" aria-label={`${jogadores.length} de ${minimo} participantes mínimos`}>
            <div style={{ width: `${Math.min(100, (jogadores.length / minimo) * 100)}%` }} />
          </div>
          <p className="apagado">
            {jogadores.length} participante{jogadores.length === 1 ? "" : "s"}
            {podeSortear ? " · sorteio liberado" : ` · falta${minimo - jogadores.length > 1 ? "m" : ""} ${minimo - jogadores.length} para liberar o sorteio`}
          </p>
          {pronto && meus > 0 && (
            <p className="seus-bilhetes">
              Você tem <strong>{meus}</strong> bilhete{meus > 1 ? "s" : ""} · chance de{" "}
              {((meus / jogadores.length) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </p>
          )}
        </div>
        <div className="destaque-acoes">
          {acaoPrincipal}
          <button className="btn btn-grande" disabled={!pronto || !podeSortear} onClick={sortear}>
            Realizar sorteio
          </button>
        </div>
      </section>

      <div className="grade">
        <section className="card">
          <header>
            <h2>Participantes</h2>
            <span className="tag">{jogadores.length}</span>
          </header>
          <ol className="lista">
            {jogadores.length === 0 && <li className="vazio">Ninguém comprou bilhete nesta rodada. Seja o primeiro!</li>}
            {jogadores.map((j, i) => (
              <li key={i} className={mesmoEndereco(j, conta) ? "sou-eu" : ""}>
                <span className="idx">#{i + 1}</span>
                <a className="mono" href={linkEndereco(j) ?? undefined} target="_blank" rel="noreferrer">
                  {curto(j)}
                </a>
                {mesmoEndereco(j, conta) && <span className="tag tag-destaque">você</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <header>
            <h2>Últimos vencedores</h2>
          </header>
          <ol className="lista">
            {historico.length === 0 && (
              <li className="vazio">
                {rodada === 0 ? "Nenhum sorteio realizado ainda." : `Último vencedor: ${curto(estado.ultimoVencedor)}`}
              </li>
            )}
            {historico.slice(0, 10).map((s) => (
              <li key={s.rodada}>
                <span className="idx">#{s.rodada}</span>
                <a className="mono" href={linkTx(s.hash) ?? undefined} target="_blank" rel="noreferrer">
                  {mesmoEndereco(s.vencedor, conta) ? "você" : curto(s.vencedor)}
                </a>
                <span className="valor">{valor(s.premio)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card largo">
          <header>
            <h2>Como funciona</h2>
          </header>
          <ol className="passos">
            <li>
              <strong>Conecte sua carteira</strong>
              <span>
                Use a MetaMask na rede {rede.name}.
                {faucet && (
                  <>
                    {" "}
                    Sem {rede.nativeCurrency.symbol}? Pegue de graça no{" "}
                    <a href={faucet} target="_blank" rel="noreferrer">
                      faucet
                    </a>
                    .
                  </>
                )}
              </span>
            </li>
            <li>
              <strong>Compre bilhetes</strong>
              <span>Cada bilhete custa {valor(preco)}. Quanto mais bilhetes, maior a chance.</span>
            </li>
            <li>
              <strong>Sorteio</strong>
              <span>
                Com {minimo} ou mais participantes, qualquer pessoa pode realizar o sorteio. O prêmio inteiro vai direto
                para a carteira do vencedor.
              </span>
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}
