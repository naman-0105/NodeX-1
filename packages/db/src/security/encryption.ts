import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard IV length for AES-GCM
const DEFAULT_DEV_MASTER_KEY = 'nodex-default-master-key-32-chars-ok!';

/**
 * Derives a 32-byte cryptographic key from the given master key string.
 */
function deriveKey(masterKey?: string): Buffer {
  const secret = masterKey || process.env.MASTER_KEY || DEFAULT_DEV_MASTER_KEY;
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: `ivHex:authTagHex:ciphertextHex`
 */
export function encrypt(plaintext: string, masterKey?: string): string {
  if (plaintext === undefined || plaintext === null) {
    throw new Error('Plaintext is required for encryption');
  }

  const key = deriveKey(masterKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts a ciphertext string created by `encrypt()`.
 * Expects format: `ivHex:authTagHex:ciphertextHex`
 */
export function decrypt(encryptedPayload: string, masterKey?: string): string {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Encrypted payload is required for decryption');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected "iv:authTag:ciphertext"');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = deriveKey(masterKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = decipher.update(ciphertextHex, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted;
}
