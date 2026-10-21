import { useState } from "react";
import { isAddress } from "viem";
import { abi, bytecode, rede, publico, salvarContratoLocal, erroLegivel, faucet, forge } from "../config.js";

/** Tela exibida quando nenhum contrato está configurado para a rede. */
export default function Configuracao({ carteira, aoConfigurar }) {
  const [endereco, setEndereco] = useState("");
  const [status, setStatus] = useState(null);
  const { conectado, redeCorreta, conta, conectar, trocarRede } = carteira;

  async function deploy() {
    setStatus({ tipo: "info", texto: "Confirme o deploy na MetaMask…" });
    try {
      const hash = await carteira.carteira.deployContract({ abi, bytecode, account: conta });
      setStatus({ tipo: "info", texto: "Aguardando confirmação na rede…" });
      const recibo = await publico.waitForTransactionReceipt({ hash });
      if (recibo.status !== "success" || !recibo.contractAddress) throw new Error("deploy revertido");
      salvarContratoLocal(recibo.contractAddress, recibo.blockNumber);
      setStatus({
        tipo: "ok",
        texto: `Implantado em ${recibo.contractAddress} (bloco ${recibo.blockNumber}). Para publicar o site, coloque esses valores no web/.env.local.`,
      });
      aoConfigurar();
    } catch (e) {
      setStatus({ tipo: "erro", texto: erroLegivel(e) });
    }
  }

  async function usarExistente(e) {
    e.preventDefault();
    try {
      const codigo = await publico.getCode({ address: endereco });
      if (!codigo || codigo === "0x") throw new Error(`não há contrato nesse endereço na ${rede.name}`);
      salvarContratoLocal(endereco, null);
      aoConfigurar();
    } catch (err) {
      setStatus({ tipo: "erro", texto: erroLegivel(err) });
    }
  }

  return (
    <div className="configuracao">
      <h1>Configure o contrato do sorteio</h1>
      <p className="lead">
        Nenhum contrato <code>Sorteio</code> configurado para a rede <strong>{rede.name}</strong>. Escolha uma opção:
      </p>

      <section className="card">
        <h2>1. Deploy com Foundry (recomendado)</h2>
        <pre className="codigo">{`# na raiz do projeto
cast wallet import deployer --interactive
forge script script/Deploy.s.sol --rpc-url ${forge.rpc} \\
  --account deployer --broadcast ${forge.verificar}

cd web && npm run usar-deploy -- ${rede.id}   # grava o endereço em web/.env.local
npm run dev`}</pre>
      </section>

      <section className="card">
        <h2>2. Deploy direto pela MetaMask</h2>
        <p>
          Usa o bytecode compilado do projeto. Você precisa de um pouco de {rede.nativeCurrency.symbol} de testnet para o
          gas{faucet ? (
            <>
              {" "}
              (pegue no{" "}
              <a href={faucet} target="_blank" rel="noreferrer">
                faucet
              </a>
              )
            </>
          ) : null}
          .
        </p>
        {!conectado ? (
          <button className="btn btn-primario" onClick={conectar}>
            Conectar carteira
          </button>
        ) : !redeCorreta ? (
          <button className="btn btn-alerta" onClick={() => trocarRede().catch(() => {})}>
            Trocar para {rede.name}
          </button>
        ) : (
          <button className="btn btn-primario" onClick={deploy}>
            Fazer deploy na {rede.name}
          </button>
        )}
      </section>

      <section className="card">
        <h2>3. Usar um contrato já implantado</h2>
        <form className="linha-form" onSubmit={usarExistente}>
          <input placeholder="0x…" value={endereco} onChange={(e) => setEndereco(e.target.value.trim())} />
          <button className="btn" disabled={!isAddress(endereco)}>
            Usar
          </button>
        </form>
      </section>

      {status && <p className={`aviso aviso-${status.tipo}`}>{status.texto}</p>}
    </div>
  );
}
