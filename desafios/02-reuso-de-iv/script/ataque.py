#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ataque AO VIVO (transações REAIS na blockchain) — Reuso de IV / two-time pad.

Encena o desafio 02 na XRPL EVM Testnet, com transações de verdade:
  1. [DONO]     implanta o MuralSecreto cifrando um segredo (ex.: "POLICHAIN").
  2. [PÚBLICO]  mostra que o cifrado e o IV ficam públicos on-chain.
  3. [ATACANTE] implanta um contrato atacante e chama recuperar():
                publica ZEROS no mural (0 ^ ks = ks -> devolve o keystream),
                faz notaSecreta XOR keystream e GRAVA o segredo recuperado
                on-chain -- tudo SEM a chave.
  4. Lê o segredo recuperado on-chain e confirma que bate com o original.

Nada aqui é simulado: deploy, publicar e gravar o segredo são transações reais.
O Python só orquestra o Foundry (forge/cast), decodifica e imprime.

Uso:
    python3 script/ataque.py

Variáveis de ambiente (todas opcionais):
    RPC=xrpl_testnet     alias do foundry.toml (padrão) ou uma URL de RPC
    ACCOUNT=deployer     keystore do Foundry usado para assinar (padrão)
    SENHA=               senha do keystore (padrão: vazia)
    PRIVKEY=0x...        usa uma chave privada direta em vez do keystore
                         (ex.: para testar num anvil local)
    SEGREDO=POLICHAIN    o texto secreto a cifrar (só no modo "deploy novo")
    MURAL=0x...          ataca um MuralSecreto JÁ implantado (pula o deploy do
                         passo 1). Vazio (padrão) = implanta um novo com SEGREDO.
"""

import json
import os
import subprocess
import sys

# A pasta do desafio (onde está o foundry.toml) = pai da pasta deste script.
PASTA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Garante o Foundry no PATH (forge/cast ficam em ~/.foundry/bin).
ENV = dict(os.environ)
ENV["PATH"] = os.path.expanduser("~/.foundry/bin") + os.pathsep + ENV.get("PATH", "")

RPC = os.environ.get("RPC", "xrpl_testnet")
ACCOUNT = os.environ.get("ACCOUNT", "deployer")
SENHA = os.environ.get("SENHA", "")
PRIVKEY = os.environ.get("PRIVKEY", "")
SEGREDO = os.environ.get("SEGREDO", "POLICHAIN")
MURAL = os.environ.get("MURAL", "")  # vazio = implanta um mural novo

EH_TESTNET = ("xrpl" in RPC) or ("xrplevm" in RPC)
EXPLORER = "https://explorer.testnet.xrplevm.org"


# --------------------------------------------------------------------------- #
# Helpers de shell (forge / cast)
# --------------------------------------------------------------------------- #
def _assinatura():
    """Flags de assinatura: chave privada direta ou keystore do Foundry."""
    if PRIVKEY:
        return ["--private-key", PRIVKEY]
    return ["--account", ACCOUNT, "--password", SENHA]


def _run(cmd):
    r = subprocess.run(
        cmd, cwd=PASTA, env=ENV, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if r.returncode != 0:
        sys.stderr.write((r.stderr or "").rstrip() + "\n")
        raise SystemExit(f"!! comando falhou ({r.returncode}): {' '.join(cmd)}")
    return (r.stdout or "").strip()


def _parse_json(out):
    """Parseia o JSON do forge/cast (pode vir formatado em várias linhas)."""
    out = out.strip()
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        i = out.find("{")
        if i == -1:
            raise
        obj, _ = json.JSONDecoder().raw_decode(out[i:])
        return obj


def cast_call(endereco, assinatura_fn):
    """cast call <endereco> <assinatura> --rpc-url RPC  (leitura, sem gas)."""
    return _run(["cast", "call", endereco, assinatura_fn, "--rpc-url", RPC])


def cast_send(endereco, assinatura_fn, *extra):
    """cast send ... --json  (transação REAL). Devolve o recibo (dict)."""
    out = _run(["cast", "send", endereco, assinatura_fn, *extra,
                "--rpc-url", RPC, *_assinatura(), "--json"])
    return _parse_json(out)


def forge_create(contrato, *cargs):
    """forge create ... --broadcast --json  (deploy REAL). Devolve o recibo (dict).

    IMPORTANTE: --constructor-args vai POR ÚLTIMO (a flag é variádica; se vier
    antes de --rpc-url/--account, engole essas flags e o deploy falha).
    """
    out = _run(["forge", "create", contrato, "--rpc-url", RPC, *_assinatura(),
                "--broadcast", "--json", "--constructor-args", *cargs])
    return _parse_json(out)


def cast_keccak(texto):
    return _run(["cast", "keccak", texto])  # não usa RPC


# --------------------------------------------------------------------------- #
# Decodificação / apresentação
# --------------------------------------------------------------------------- #
def hex_bytes(h):
    h = h[2:] if h.startswith("0x") else h
    return bytes.fromhex(h)


def hex_para_texto(h):
    b = hex_bytes(h)
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        return repr(b)


def titulo(t):
    print("\n" + "=" * 64)
    print(" " + t)
    print("=" * 64)


def link_endereco(addr):
    return f"{EXPLORER}/address/{addr}" if EH_TESTNET else "(rede local)"


def link_tx(h):
    return f"{EXPLORER}/tx/{h}" if EH_TESTNET else "(rede local)"


# --------------------------------------------------------------------------- #
# Roteiro do ataque
# --------------------------------------------------------------------------- #
def main():
    segredo_hex = "0x" + SEGREDO.encode("utf-8").hex()
    # "Chave mestra" do dono. O atacante NUNCA usa isto — é só para o dono cifrar.
    chave = cast_keccak("chave-mestra-do-dono-nao-use-em-producao")

    print(f"Rede: {RPC}" + ("  (XRPL EVM Testnet)" if EH_TESTNET else "  (local)"))
    print(f"Assinando com: {'chave privada' if PRIVKEY else f'keystore {ACCOUNT!r}'}")

    # ---- 1. Alvo: contrato já existente (MURAL=0x...) OU um novo (deploy) ---
    if MURAL:
        titulo("1) [ALVO] atacando um MuralSecreto JÁ implantado na rede")
        mural = MURAL
        alvo_conhecido = False  # não sabemos o texto em claro do segredo dele
        print(f"  MuralSecreto : {mural}")
        print(f"  explorer     : {link_endereco(mural)}")
        print("  (o dono já cifrou o segredo; vamos recuperá-lo sem a chave)")
    else:
        titulo("1) [DONO] cifra um segredo no mural (deploy real)")
        alvo_conhecido = True  # nós mesmos ciframos -> sabemos o esperado
        print(f"  segredo em claro : {SEGREDO!r}  ->  {segredo_hex}")
        print(f"  chave do dono    : {chave}  (secreta; o ataque NÃO vai usá-la)")
        rec = forge_create("src/MuralSecreto.sol:MuralSecreto", chave, segredo_hex)
        mural = rec["deployedTo"]
        print(f"  MuralSecreto     : {mural}")
        print(f"  tx deploy        : {rec.get('transactionHash', '?')}")
        print(f"  explorer         : {link_endereco(mural)}")

    # ---- 2. O que ficou público on-chain -----------------------------------
    titulo("2) O que QUALQUER UM lê on-chain")
    nota = cast_call(mural, "notaSecreta()(bytes)")
    iv = cast_call(mural, "ivNota()(uint256)")
    print(f"  notaSecreta (cifrado): {nota}")
    print(f"  IV da nota           : {iv}")
    print("  -> parece ruído, mas o IV é keccak(dono): é FIXO e se repete sempre.")

    # ---- 3. Atacante implanta o contrato de ataque (deploy real) -----------
    titulo("3) [ATACANTE] implanta o contrato de ataque (deploy real)")
    print("  (o atacante é qualquer um: recuperar() só usa funções PÚBLICAS)")
    recA = forge_create("script/AtacanteLive.sol:AtacanteLive", mural)
    atacante = recA["deployedTo"]
    print(f"  AtacanteLive : {atacante}")
    print(f"  tx deploy    : {recA.get('transactionHash', '?')}")
    print(f"  explorer     : {link_endereco(atacante)}")

    # ---- 4. Executa o ataque (transação real: publica zeros + grava) -------
    titulo("4) [ATACANTE] recuperar(): publica ZEROS e grava o segredo (tx real)")
    rrec = cast_send(atacante, "recuperar()")
    print("  publicou N bytes 0x00 no mural -> o cifrado devolvido É o keystream")
    print("  depois: segredo = notaSecreta XOR keystream  (sem a chave!)")
    print(f"  tx do ataque : {rrec.get('transactionHash', '?')}")
    print(f"  explorer     : {link_tx(rrec.get('transactionHash', ''))}")

    # ---- 5. Lê o segredo recuperado, GRAVADO on-chain ----------------------
    titulo("5) Segredo recuperado (lido do estado on-chain)")
    recuperado_hex = cast_call(atacante, "segredoRecuperado()(bytes)")
    recuperado = hex_para_texto(recuperado_hex)
    print(f"  segredoRecuperado (bytes): {recuperado_hex}")
    print(f"  >>> SEGREDO RECUPERADO    : {recuperado!r}")
    print()
    if alvo_conhecido:
        if recuperado == SEGREDO:
            print("  ✅ Bate com o original. Quebrado SEM a chave, só com reuso de IV.")
        else:
            print("  ⚠️  Não bateu com o esperado — confira o tamanho/segredo.")
    else:
        print("  ✅ Segredo extraído do contrato da rede SEM a chave (reuso de IV).")

    titulo("FIM")
    print("  Lição: um IV repetido transforma a cifra de fluxo em XOR de textos claros.")
    print("  Aqui o IV é keccak(dono) (fixo para sempre) -> um único publicar() de")
    print("  zeros revela o keystream e decifra TUDO que o mural já cifrou.")
    if EH_TESTNET:
        print(f"\n  Mural   : {link_endereco(mural)}")
        print(f"  Atacante: {link_endereco(atacante)}")


if __name__ == "__main__":
    main()
