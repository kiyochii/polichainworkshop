# Writeup: Desafio 02, Reuso de IV (two-time pad)

> ⚠️ **Spoiler.** Este documento traz a solução completa do desafio. Não distribua antes do exercício.

| | |
|---|---|
| **Categoria** | Smart contracts / Criptografia aplicada |
| **Vulnerabilidade** | Reuso de IV/nonce em cifra de fluxo (*two-time pad*) |
| **Dificuldade** | Avançada |
| **Alvo** | `src/MuralSecreto.sol` |
| **Objetivo** | Recuperar o texto em claro de `notaSecreta` **sem a chave** (`test/Exploit.t.sol` passar) |

## TL;DR

`MuralSecreto` cifra com uma cifra de fluxo caseira: `cifrado = texto ⊕ keystream`, onde
`keystream = keccak256(chave, iv, contador)`. O `iv` vem de `block.number / 256` — um parâmetro da chain que
**se repete** por 256 blocos. Logo, toda mensagem da mesma época usa o **mesmo keystream**. O atacante publica,
na mesma época, um texto conhecido (zeros) do tamanho da nota; o cifrado devolvido **é** o keystream
(`0 ⊕ K = K`). Então `segredo = notaSecreta ⊕ keystream`. A chave nunca é usada.

---

## 1. O desafio

Um "mural" on-chain de mensagens cifradas:

- `publicar(texto)`: **qualquer um** cifra uma mensagem e ela entra no `mural`. Retorna o cifrado e o IV.
- `notaSecreta` / `ivNota`: o dono cifrou um segredo no deploy; o **cifrado** fica público (é só estado).
- `revelarNota(chave)`: só o dono, com a chave certa, decifra a própria nota.

No `test/Exploit.t.sol`, o segredo é `PARABENS{reuso_de_iv_e_two_time_pad}`, cifrado no bloco 1000. O atacante
controla o contrato `Atacante`, age no bloco 1020 (mesma época) e precisa devolver o segredo em claro —
**sem** conhecer a `chave`.

## 2. Cifra de fluxo em 30 segundos

Gera-se um keystream pseudoaleatório a partir de `(chave, IV)` e faz-se XOR com o texto:

```
cifrado = texto ⊕ keystream        decifrar: texto = cifrado ⊕ keystream
```

É seguro **enquanto cada par `(chave, IV)` for usado uma única vez**. O IV (*initialization vector* / nonce)
existe justamente para que a **mesma** chave produza keystreams **diferentes** em mensagens diferentes. Ele
não precisa ser secreto — precisa ser **único**.

## 3. A vulnerabilidade: o IV se repete

O coração do contrato:

```solidity
uint256 public constant INTERVALO_IV = 256;

function _iv() internal view returns (uint256) {
    return block.number / INTERVALO_IV;   // <- parâmetro da chain que se repete
}

function _keystream(uint256 iv, uint256 tamanho) internal view returns (bytes memory ks) {
    // ks = keccak256(chave, iv, 0) || keccak256(chave, iv, 1) || ...
}

function _cifrar(bytes memory texto, uint256 iv) internal view returns (bytes memory) {
    // out[i] = texto[i] ^ ks[i]
}
```

O desenvolvedor "rotaciona" o IV a cada 256 blocos achando que isso evita repetição. Mas **dentro de uma
época** (`block.number / 256` constante) o IV é idêntico para **todas** as mensagens — inclusive a nota
secreta e qualquer coisa que o atacante publicar no mesmo intervalo. Época 3, por exemplo, cobre os blocos
768–1023:

```bash
forge test --match-test test_iv_se_repete_na_mesma_epoca -vv
# IV da nota (epoca 3): 3
# IV em outra epoca (4): 4
```

Com o IV repetido, dois cifrados compartilham o keystream `K`:

```
Ca = A ⊕ K
Cb = B ⊕ K
Ca ⊕ Cb = A ⊕ B      ← o keystream some
```

Isso é o **two-time pad**. Pior: a função `publicar()` é um **oráculo de cifragem** sob o mesmo IV. O atacante
escolhe `A`. Se `A = 0...0`, então `Ca = 0 ⊕ K = K`: o cifrado devolvido **é** o keystream.

## 4. Exploração

### Ideia

1. Ler `notaSecreta()` (público) e o seu tamanho `n`.
2. Publicar, **na mesma época**, `n` bytes zero. O retorno é o keystream `K` daquela época.
3. `segredo = notaSecreta ⊕ K`.

Nenhuma dessas etapas toca na `chave`.

### Código (`solucao/Atacante.sol`)

```solidity
function recuperarSegredo() external returns (bytes memory segredo) {
    bytes memory nota = alvo.notaSecreta();     // 1. cifrado público do segredo
    uint256 n = nota.length;

    bytes memory conhecido = new bytes(n);      // 2. n bytes 0x00
    (bytes memory cifradoConhecido, ) = alvo.publicar(conhecido); // mesmo IV -> mesmo keystream

    segredo = new bytes(n);
    for (uint256 i; i < n; i++) {
        bytes1 ks = cifradoConhecido[i] ^ conhecido[i];  // 3. keystream (= cifrado, pois conhecido é zero)
        segredo[i] = nota[i] ^ ks;                       // 4. segredo = nota ⊕ keystream
    }
}
```

Detalhes que costumam derrubar quem está resolvendo:

- **Mesma época.** `recuperarSegredo()` precisa rodar enquanto `block.number / 256` for igual ao da nota.
  Fora da época, o IV muda e o keystream não bate. (No teste: nota no bloco 1000, ataque no 1020.)
- **Tamanho.** O texto publicado precisa ter **pelo menos** o tamanho da nota, senão falta keystream.
- **Manter o XOR explícito.** Usar zeros é um atalho (`Ca = K`), mas o XOR `conhecido ⊕ cifrado` funciona com
  qualquer texto conhecido — útil quando só se conhece um pedaço do claro (*crib dragging*).
- **Não precisa da chave.** É o ponto da aula: mesmo que a `chave` fosse perfeitamente secreta, o reuso de IV
  já entrega o claro.

### Prova

```bash
cp solucao/Atacante.sol src/Atacante.sol
sed -i '' 's#"../src/MuralSecreto.sol"#"./MuralSecreto.sol"#' src/Atacante.sol   # Linux: sed -i
forge test --match-contract ExploitTest -vv
```

```
[PASS] test_atacante_recupera_o_segredo() (gas: 237377)
Logs:
  Segredo recuperado: PARABENS{reuso_de_iv_e_two_time_pad}
```

## 5. Particularidade da XRPL EVM Testnet

Na XRPL EVM Testnet (chainId `1449000`), `block.prevrandao` (o antigo `difficulty`/`mixHash`) vem **sempre 0**
— o mesmo detalhe que aparece no Desafio 01. Se este contrato derivasse o IV de `block.prevrandao`, o IV seria
**0 para sempre**, em qualquer bloco: todas as mensagens de toda a vida do contrato compartilhariam um único
keystream. O two-time pad viraria um "pad infinito" — qualquer publicação de zeros vazaria o keystream e
decifraria **todo** o histórico do mural. Derivar IV de `block.number / N` é "só" ruim por época; de
`prevrandao` nessa rede, seria catastrófico de forma permanente.

## 6. Casos reais

- **Reuso de nonce no WEP (Wi-Fi):** o IV de 24 bits do RC4 se repetia em horas de tráfego, permitindo
  recuperar o keystream e, com ele, a chave. Foi o fim do WEP.
- **PS3 (ECDSA) e Sony:** não é cifra de fluxo, mas a mesma família de erro — reuso do nonce `k` em
  assinaturas ECDSA vazou a chave privada de assinatura do console.
- **AES-GCM com nonce repetido:** além de vazar o claro, permite recuperar a chave de autenticação (Poly1305)
  e **forjar** mensagens. Documentado em várias análises de APIs que reusavam nonce.

## 7. Correção

### a) Nonce único por mensagem

Nunca derive o IV de um valor da chain que possa repetir. Use um contador que **só cresce** (ou um nonce
aleatório suficientemente grande) e guarde-o junto do cifrado:

```solidity
uint256 private nonce;

function publicar(bytes calldata texto) external returns (bytes memory cifrado, uint256 iv) {
    iv = nonce++;                 // único por mensagem, monotônico
    cifrado = _cifrar(texto, iv);
    // guardar (iv, cifrado)
}
```

### b) Prefira primitivas prontas e autenticadas

Cifra de fluxo caseira com keccak é frágil. Fora da chain, use AES-GCM ou XChaCha20-Poly1305 (nonce grande,
sorteado) com autenticação — e trate o reuso de nonce como falha crítica.

### c) Não "esconda" dados on-chain

Todo o estado é público: o cifrado, o IV e **a própria `chave`** em `storage` (basta `eth_getStorageAt` no
slot certo). `private` só esconde do Solidity, não da rede. Para confidencialidade de verdade:

- cifre **fora** da chain e publique só o cifrado (a chave nunca toca o contrato); ou
- use commit-reveal, provas de conhecimento zero (ZK), FHE, TEE ou decriptação por threshold.

### d) O que **não** resolve

- Marcar a `chave` como `private` ou `immutable`.
- "Rotacionar" o IV por tempo/época (o problema é repetir dentro da janela).
- Trocar `keccak256` por outra função de hash — enquanto `(chave, IV)` se repetir, o XOR de claros continua.

## 8. Lições

- **Regra de ouro:** um IV repetido transforma qualquer cifra de fluxo em XOR de textos claros.
- Um IV não precisa ser secreto, mas **precisa ser único** por `(chave, mensagem)`.
- Uma função pública de cifrar sob IV fixo é um **oráculo**: com texto escolhido (zeros), ela entrega o
  keystream de graça.
- Blockchain não dá confidencialidade: cifrar on-chain protege contra ninguém.

## Referências

- [SWC-120: Weak Sources of Randomness from Chain Attributes](https://swcregistry.io/docs/SWC-120) (parente: dados de bloco previsíveis)
- [Cryptopals — Set 3: fixed-nonce CTR / two-time pad](https://cryptopals.com/sets/3)
- [NIST SP 800-38D (GCM): exigência de nonce único](https://csrc.nist.gov/pubs/sp/800/38/d/final)
- [XRPL EVM: documentação](https://docs.xrplevm.org)
- Arquivos do desafio: `src/MuralSecreto.sol`, `solucao/Atacante.sol`, `test/Exploit.t.sol`, `test/MuralSecreto.t.sol`
