import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/security/encryption.js';

describe('AES-256-GCM Encryption Vault Unit Tests', () => {
  it('encrypts and decrypts strings symmetrically', () => {
    const sensitiveTokens = [
      'xoxb-1234567890-super-secret-slack-token',
      'ghp_abcdef1234567890abcdef1234567890',
      'password with special chars !@#$%^&*()_+{}[]:;<>,.?/',
      '{"accessToken":"xoxb-123","teamId":"T123","teamName":"Workspace"}',
    ];

    for (const token of sensitiveTokens) {
      const encrypted = encrypt(token);
      expect(encrypted).not.toBe(token);
      expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(token);
    }
  });

  it('generates distinct initialization vectors (IV) for the same plaintext', () => {
    const token = 'xoxb-constant-token';
    const enc1 = encrypt(token);
    const enc2 = encrypt(token);

    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1)).toBe(token);
    expect(decrypt(enc2)).toBe(token);
  });

  it('supports custom master keys', () => {
    const customKey1 = 'custom-master-key-1';
    const customKey2 = 'custom-master-key-2';
    const token = 'sensitive-data';

    const enc = encrypt(token, customKey1);
    expect(decrypt(enc, customKey1)).toBe(token);
    expect(() => decrypt(enc, customKey2)).toThrow();
  });

  it('throws descriptive errors on malformed payloads', () => {
    expect(() => decrypt('')).toThrow(/required/);
    expect(() => decrypt('invalid-payload')).toThrow(/Invalid encrypted payload format/);
    expect(() => decrypt('part1:part2')).toThrow(/Invalid encrypted payload format/);
  });

  it('fails decryption when ciphertext or authentication tag is tampered', () => {
    const enc = encrypt('secret');
    const [iv, tag, cipher] = enc.split(':');

    // Flip bits in ciphertext
    const tamperedCipher = cipher.slice(0, -2) + (cipher.slice(-2) === 'aa' ? 'bb' : 'aa');
    expect(() => decrypt(`${iv}:${tag}:${tamperedCipher}`)).toThrow();

    // Tamper with tag
    const tamperedTag = tag.slice(0, -2) + (tag.slice(-2) === '00' ? '11' : '00');
    expect(() => decrypt(`${iv}:${tamperedTag}:${cipher}`)).toThrow();
  });
});
