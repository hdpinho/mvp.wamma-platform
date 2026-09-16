package com.wamma.platform.crypto;

/** El dato no se pudo descifrar: la clave no es la misma o el dato fue alterado. */
public class FieldDecryptionException extends RuntimeException {

    public FieldDecryptionException() {
        super("El dato cifrado no se pudo descifrar: clave distinta o dato alterado");
    }
}
