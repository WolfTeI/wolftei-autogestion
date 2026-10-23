/**
 * Utilidad criptográfica basada en Web Crypto API (SubtleCrypto)
 * para cifrado y descifrado de credenciales sensibles (AES-256-GCM).
 * Cumple con estándares de ciberseguridad OWASP A02 e ISO 27001 (Control 8.24).
 */
export class VaultCrypto {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;

  /**
   * Deriva una CryptoKey de AES-256 a partir de una clave maestra o PIN usando PBKDF2 con SHA-256.
   */
  private static async deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Cifra un texto plano en AES-256-GCM con salt e IV aleatorios generados por CSPRNG.
   * @param plainText Texto o contraseña a cifrar
   * @param masterKey Clave maestra u operadora
   */
  static async encrypt(
    plainText: string,
    masterKey = 'WolfTeI-Vault-LocalKey-2026'
  ): Promise<{ cipherTextHex: string; ivHex: string; saltHex: string }> {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    const key = await this.deriveKey(masterKey, salt);
    const enc = new TextEncoder();
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv: iv as any },
      key,
      enc.encode(plainText)
    );

    return {
      cipherTextHex: this.buf2hex(new Uint8Array(cipherBuffer)),
      ivHex: this.buf2hex(iv),
      saltHex: this.buf2hex(salt),
    };
  }

  /**
   * Descifra un texto en AES-256-GCM.
   */
  static async decrypt(
    cipherTextHex: string,
    ivHex: string,
    saltHex: string,
    masterKey = 'WolfTeI-Vault-LocalKey-2026'
  ): Promise<string> {
    try {
      const salt = this.hex2buf(saltHex);
      const iv = this.hex2buf(ivHex);
      const cipherBuffer = this.hex2buf(cipherTextHex);

      const key = await this.deriveKey(masterKey, salt);
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv: iv as any },
        key,
        cipherBuffer as any
      );

      const dec = new TextDecoder();
      return dec.decode(decryptedBuffer);
    } catch (err) {
      console.error('Error al descifrar credencial:', err);
      throw new Error('No se pudo descifrar la credencial (clave incorrecta o datos corruptos).');
    }
  }

  private static buf2hex(buf: Uint8Array): string {
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  private static hex2buf(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
}
