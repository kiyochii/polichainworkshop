import { linkTx } from "../config.js";

export default function Notificacoes({ itens, fechar }) {
  return (
    <div className="notificacoes" aria-live="polite">
      {itens.map((n) => (
        <div key={n.id} className={`notificacao notificacao-${n.tipo}`}>
          <div>
            <strong>{n.titulo}</strong>
            {n.texto && <p>{n.texto}</p>}
            {n.hash && linkTx(n.hash) && (
              <a href={linkTx(n.hash)} target="_blank" rel="noreferrer">
                Ver no explorer ↗
              </a>
            )}
          </div>
          <button className="fechar" onClick={() => fechar(n.id)} aria-label="Fechar">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
