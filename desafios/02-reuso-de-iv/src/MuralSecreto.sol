// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MuralSecreto — VULNERÁVEL DE PROPÓSITO (material de workshop)
/// @notice NÃO USE EM PRODUÇÃO. "Cifra" mensagens com um keystream XOR
///         (cifra de fluxo caseira). O IV vem de um parâmetro da chain
///         (`block.number`, em "épocas") e, por isso, SE REPETE: toda mensagem
///         da mesma época é cifrada com o MESMO keystream. Isso é um
///         "two-time pad" — basta um texto conhecido para quebrar tudo.
///
/// @dev    A chave mestra `chave` é tratada como secreta (o ideal seria mantê-la
///         fora da chain). O ataque deste desafio NÃO usa a chave: ele recupera
///         o texto em claro só com a função pública de cifrar e o texto cifrado,
///         explorando a REPETIÇÃO DO IV. (Bônus: on-chain a própria `chave` é
///         legível via eth_getStorageAt — confidencialidade on-chain é ilusão.)
contract MuralSecreto {
    /// @notice Quantos blocos duram uma "época" de IV. O desenvolvedor achou que
    ///         "trocar o IV de tempos em tempos" bastava — mas dentro da mesma
    ///         época o IV é constante.
    uint256 public constant INTERVALO_IV = 256;

    bytes32 private immutable chave; // "secreta": sem getter. O ataque não precisa dela.
    address public immutable dono;

    /// @notice Texto cifrado do segredo do dono (fica público on-chain, como todo estado).
    bytes public notaSecreta;
    /// @notice IV usado para cifrar `notaSecreta`. IVs não são secretos — o problema é repeti-los.
    uint256 public ivNota;

    struct Post {
        address autor;
        bytes cifrado;
        uint256 iv;
    }

    Post[] public mural;

    event Publicado(address indexed autor, uint256 indexed indice, uint256 iv, uint256 tamanho);

    constructor(bytes32 _chave, bytes memory segredo) {
        chave = _chave;
        dono = msg.sender;
        ivNota = _iv();
        notaSecreta = _cifrar(segredo, ivNota);
    }

    /// @notice O IV "rotaciona" a cada época... mas é IDÊNTICO para todos os
    ///         blocos da mesma época. VULNERABILIDADE: parâmetro da chain
    ///         (`block.number`) que se repete → reuso de IV.
    function _iv() internal view returns (uint256) {
        return block.number / INTERVALO_IV;
    }

    /// @notice Keystream de `tamanho` bytes a partir de (chave, iv).
    ///         keccak em blocos de 32 bytes: bloco_c = keccak256(chave, iv, c).
    function _keystream(uint256 iv, uint256 tamanho) internal view returns (bytes memory ks) {
        ks = new bytes(tamanho);
        uint256 i;
        uint256 contador;
        while (i < tamanho) {
            bytes32 bloco = keccak256(abi.encode(chave, iv, contador));
            for (uint256 j; j < 32 && i < tamanho; j++) {
                ks[i] = bloco[j];
                i++;
            }
            contador++;
        }
    }

    function _cifrar(bytes memory texto, uint256 iv) internal view returns (bytes memory out) {
        bytes memory ks = _keystream(iv, texto.length);
        out = new bytes(texto.length);
        for (uint256 i; i < texto.length; i++) {
            out[i] = texto[i] ^ ks[i];
        }
    }

    /// @notice Qualquer um publica uma mensagem cifrada no mural.
    ///         Usa o MESMO IV (o da época atual) para todo mundo.
    /// @return cifrado o texto cifrado; iv o IV usado (público).
    function publicar(bytes calldata texto) external returns (bytes memory cifrado, uint256 iv) {
        iv = _iv();
        cifrado = _cifrar(texto, iv);
        mural.push(Post({autor: msg.sender, cifrado: cifrado, iv: iv}));
        emit Publicado(msg.sender, mural.length - 1, iv, texto.length);
    }

    /// @notice Só o dono decifra a própria nota (precisa da chave de verdade).
    function revelarNota(bytes32 _chave) external view returns (bytes memory) {
        require(msg.sender == dono, "so o dono");
        require(_chave == chave, "chave errada");
        return _cifrar(notaSecreta, ivNota); // XOR de novo = texto em claro
    }

    function totalPosts() external view returns (uint256) {
        return mural.length;
    }

    function ivAtual() external view returns (uint256) {
        return _iv();
    }
}
