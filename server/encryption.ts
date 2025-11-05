import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET environment variable is not set');
  }
  
  // Derive a consistent 32-byte key from the secret
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  // crypto.randomBytes generates a cryptographically secure random IV for each encryption,
  // ensuring IV uniqueness across all encryptions. This is critical for AES-GCM security.
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext (all hex encoded)
  // PRODUCTION RECOMMENDATION: Implement key rotation policy (e.g., rotate ENCRYPTION_SECRET
  // every 90 days) and maintain a key versioning system to support decryption of older tokens.
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey();
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
