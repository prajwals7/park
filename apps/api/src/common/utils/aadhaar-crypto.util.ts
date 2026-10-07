import crypto from 'crypto';
import { env } from '../env.js';

export interface EncryptedAadhaarPayload {
  keyVersion: string;
  iv: string; // Hex 12 bytes nonce for GCM
  authTag: string; // Hex 16 bytes auth tag
  ciphertext: string; // Hex encrypted ciphertext
}

export class AadhaarCryptoUtil {
  /**
   * Encrypts a 12-digit Aadhaar number using AES-256-GCM.
   * Derives a 256-bit key using HKDF from the master key.
   */
  static encrypt(
    plainAadhaar: string,
    keyVersion: string = env.AADHAAR_KEY_VERSION,
    masterKey: string = env.AADHAAR_MASTER_KEY,
  ): string {
    const clean = plainAadhaar.replace(/\s+/g, '');
    const iv = crypto.randomBytes(12); // 96-bit nonce for AES-GCM

    // Derive version-specific 256-bit encryption key
    const derivedKey = crypto.hkdfSync('sha256', masterKey, 'aadhaar-salt', keyVersion, 32);

    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(derivedKey), iv);
    const ciphertext = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const payload: EncryptedAadhaarPayload = {
      keyVersion,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: ciphertext.toString('hex'),
    };

    return JSON.stringify(payload);
  }

  /**
   * Decrypts an AES-256-GCM encrypted Aadhaar payload.
   */
  static decrypt(encryptedJson: string, masterKey: string = env.AADHAAR_MASTER_KEY): string {
    const payload: EncryptedAadhaarPayload = JSON.parse(encryptedJson);
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const ciphertext = Buffer.from(payload.ciphertext, 'hex');

    // Derive key using stored keyVersion
    const derivedKey = crypto.hkdfSync('sha256', masterKey, 'aadhaar-salt', payload.keyVersion, 32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(derivedKey), iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Computes blind HMAC-SHA256 hash using a separate dedicated secret
   * for fast duplicate checking without exposing plaintext.
   */
  static hashForDuplicateCheck(
    plainAadhaar: string,
    hmacSecret: string = env.AADHAAR_HMAC_SECRET,
  ): string {
    const clean = plainAadhaar.replace(/\s+/g, '');
    return crypto.createHmac('sha256', hmacSecret).update(clean).digest('hex');
  }

  /**
   * Key Rotation: Re-encrypts an existing payload under a new master key / key version.
   */
  static rotate(
    encryptedJson: string,
    oldMasterKey: string,
    newMasterKey: string,
    newKeyVersion: string,
  ): string {
    const plaintext = this.decrypt(encryptedJson, oldMasterKey);
    return this.encrypt(plaintext, newKeyVersion, newMasterKey);
  }

  /**
   * Redacts any 12-digit Aadhaar patterns from strings to prevent accidental log leakage.
   */
  static redact(text: string): string {
    if (!text) return text;
    // Matches 12-digit Indian Aadhaar patterns with or without spaces
    return text.replace(/\b([2-9]\d{3})\s?(\d{4})\s?(\d{4})\b/g, 'XXXX-XXXX-$3');
  }
}
