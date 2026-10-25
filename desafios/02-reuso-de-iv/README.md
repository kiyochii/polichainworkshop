# Desafio 02: Reuso de IV (two-time pad)

> ⚠️ O contrato é **vulnerável de propósito**. Use somente em testnet.

**Público:** avançado (confortável com Solidity e com noções de criptografia) · **Duração sugerida:** ~90 min · **Ferramenta:** Foundry

## Estrutura

```
src/MuralSecreto.sol   # o mural "cifrado" vulnerável (alvo)
src/Atacante.sol       # esqueleto do exercício (TODOs)
test/MuralSecreto.t.sol# Parte 1: fluxo normal + prova de que o IV se repete
test/Exploit.t.sol     # Parte 2: passa quando o Atacante recuperar o segredo
solucao/Atacante.sol   # solução — NÃO distribuir antes do exercício
```

## Setup

```bash
cd desafios/02-reuso-de-iv
forge build
forge test   # esperado: MuralSecreto passa (3/4), Exploit FALHA
```

> Publique o repositório **sem** a pasta `solucao/` (ou numa branch separada).

---

## Roteiro

### 1. Contexto (15 min)

Cifra de fluxo em uma frase: gera-se um **keystream** pseudoaleatório a partir de `(chave, IV)` e faz-se
`cifrado = texto ⊕ keystream`. Decifrar é o mesmo XOR de novo. É seguro **enquanto cada par `(chave, IV)`
for usado uma única vez**.

A regra de ouro das cifras de fluxo / modo CTR / AES-GCM:

> **Nunca reutilize o mesmo `(chave, IV)` para duas mensagens.**

Se dois textos `A` e `B` forem cifrados com o **mesmo** keystream `K`:

```
Ca = A ⊕ K
Cb = B ⊕ K
Ca ⊕ Cb = A ⊕ B        ← o keystream some; sobra a relação entre os dois claros
```

Isso é o **two-time pad**. Com um dos claros conhecido (ou adivinhável, via *crib dragging*), o outro cai.
E se o claro conhecido for **tudo zero**, então `C = 0 ⊕ K = K`: o cifrado **é** o keystream.

### 2. Apresentar o contrato (15 min)

Ler `src/MuralSecreto.sol` juntos. É um "mural" onde qualquer um publica mensagens cifradas, e o dono guarda
uma `notaSecreta`. Perguntar à turma: *"onde está o problema?"* antes de revelar.

Pontos-chave:
- `_cifrar` usa `keystream = keccak256(chave, iv, contador)` em blocos de 32 bytes — uma cifra de fluxo caseira.
- `publicar()` é **pública** e usa o **mesmo IV** para todos.
- O IV vem de `keccak256(dono)` — o hash do **endereço do dono** (a chave pública de quem publicou o
  contrato). É um **parâmetro fixo da chain**, então o IV **nunca muda**.

### 3. Demo: o IV é fixo (10 min)

```bash
forge test --match-test test_iv_e_fixo_para_sempre -vv
forge test --match-test test_zeros_revelam_o_keystream -vv
```

Blocos quaisquer produzem sempre o **mesmo IV** (`keccak(dono)`) — e publicar zeros devolve o keystream cru.

### 4. Exercício: recuperar o segredo (30 min)

Implemente `src/Atacante.sol` (sem usar a chave!) e rode:

```bash
forge test --match-contract ExploitTest -vv
```

**Dicas progressivas** (liberar a cada ~10 min):
1. `notaSecreta()` é público — o texto cifrado do segredo já está na sua mão.
2. Você também pode cifrar o que quiser com o **mesmo IV** (ele é fixo) → o **mesmo keystream**.
3. Publique zeros do tamanho da nota: o que volta é o keystream. Agora `segredo = notaSecreta ⊕ keystream`.

Ao final, mostrar `solucao/Atacante.sol`. Para validar:

```bash
cp solucao/Atacante.sol src/Atacante.sol
sed -i '' 's#"../src/MuralSecreto.sol"#"./MuralSecreto.sol"#' src/Atacante.sol   # Linux: sed -i
forge test --match-contract ExploitTest -vv
```

### 5. Mitigação (20 min)

- **Nonce único por mensagem.** Um contador que **só cresce** (ou um nonce aleatório grande) guardado junto
  do cifrado. Nunca derive o IV de um valor da chain que se repete.
- **AES-GCM / Poly1305:** reusar o nonce não só vaza o claro como **quebra a autenticação** (permite forjar
  mensagens). Ainda mais grave.
- **Confidencialidade on-chain é ilusão.** Todo estado é público: o cifrado, o IV e **a própria chave** em
  `storage` (via `eth_getStorageAt`). Para dados confidenciais, cifre **fora** da chain e guarde só o cifrado,
  ou use ferramentas específicas (commit-reveal, ZK, FHE, TEE, decriptação por threshold).
- **O que NÃO resolve:** marcar a chave como `private`, derivar o IV de qualquer valor fixo/previsível
  (endereço do dono, `chainid`, uma constante), ou trocar o keccak por outra função — enquanto o `(chave, IV)`
  se repetir, o two-time pad continua.

### 6. Encerramento (10 min)

- Regra de ouro: **um IV repetido transforma qualquer cifra de fluxo em XOR de textos claros.**
- Como o IV aqui é `keccak(dono)` (fixo para sempre), **todo** o histórico do mural compartilha um único
  keystream: um único `publicar()` de zeros decifra tudo, hoje ou daqui a um ano.

## Comandos úteis

```bash
forge test                                     # todos os testes
forge test --match-contract ExploitTest -vvvv  # trace completo do ataque
```
