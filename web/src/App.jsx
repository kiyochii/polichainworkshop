import { useCallback, useState } from "react";
import Cabecalho from "./components/Cabecalho.jsx";
import Configuracao from "./components/Configuracao.jsx";
import Notificacoes from "./components/Notificacoes.jsx";
import Painel from "./components/Painel.jsx";
import { useCarteira } from "./hooks/useCarteira.js";
import { contratoConfigurado, esquecerContratoLocal, linkEndereco, rede, curto } from "./config.js";

export default function App() {
  const carteira = useCarteira();
  const [contrato, setContrato] = useState(contratoConfigurado);
  const [notificacoes, setNotificacoes] = useState([]);

  const fechar = useCallback((id) => setNotificacoes((ns) => ns.filter((n) => n.id !== id)), []);

  /** Cria ou atualiza (mesmo id) uma notificação. Sucessos somem sozinhos. */
  const notificar = useCallback(
    ({ id = crypto.randomUUID(), ...n }) => {
      setNotificacoes((ns) => [...ns.filter((x) => x.id !== id), { id, ...n }]);
      if (n.tipo === "ok") setTimeout(() => fechar(id), 10000);
      return id;
    },
    [fechar],
  );

  return (
    <>
      <Cabecalho carteira={carteira} />

      <main className="conteudo">
        {contrato ? (
          <Painel key={contrato.endereco} contrato={contrato} carteira={carteira} notificar={notificar} />
        ) : (
          <Configuracao carteira={carteira} aoConfigurar={() => setContrato(contratoConfigurado())} />
        )}
      </main>

      <footer className="conteudo rodape">
        <span>Rede de testes {rede.name}. Não use fundos reais.</span>
        {contrato && (
          <span>
            Contrato{" "}
            <a className="mono" href={linkEndereco(contrato.endereco) ?? undefined} target="_blank" rel="noreferrer">
              {curto(contrato.endereco)}
            </a>
            {contrato.origem === "local" && (
              <>
                {" · "}
                <button
                  className="link"
                  onClick={() => {
                    esquecerContratoLocal();
                    setContrato(contratoConfigurado());
                  }}
                >
                  trocar
                </button>
              </>
            )}
          </span>
        )}
      </footer>

      <Notificacoes itens={notificacoes} fechar={fechar} />
    </>
  );
}
