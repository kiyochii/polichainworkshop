import { rede, curto } from "../config.js";

export default function Cabecalho({ carteira }) {
  const { temCarteira, conectado, redeCorreta, conta, conectando, conectar, trocarRede } = carteira;

  return (
    <header className="cabecalho">
      <div className="conteudo cabecalho-linha">
        <a className="marca" href="/">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <circle cx="10" cy="10" r="2.6" fill="var(--fundo)" />
            <circle cx="16" cy="16" r="2.6" fill="var(--fundo)" />
            <circle cx="22" cy="22" r="2.6" fill="var(--fundo)" />
          </svg>
          Sorteio
        </a>

        <div className="cabecalho-acoes">
          <span className={`pilula ${conectado && !redeCorreta ? "pilula-alerta" : ""}`}>
            <span className="ponto" />
            {rede.name}
          </span>
          {!temCarteira ? (
            <a className="btn btn-primario" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
              Instalar MetaMask
            </a>
          ) : !conectado ? (
            <button className="btn btn-primario" onClick={conectar} disabled={conectando}>
              {conectando ? "Conectando…" : "Conectar carteira"}
            </button>
          ) : !redeCorreta ? (
            <button className="btn btn-alerta" onClick={() => trocarRede().catch(() => {})}>
              Trocar para {rede.name}
            </button>
          ) : (
            <span className="conta mono">{curto(conta)}</span>
          )}
        </div>
      </div>
    </header>
  );
}
