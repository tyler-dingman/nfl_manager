import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

export const secureToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function secretKey() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error('AUTH_JWT_SECRET is required');
  return createHash('sha256').update(secret).digest();
}
export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}
export function decryptSecret(value: string) {
  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) throw new Error('Encrypted value is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

export const hashPassword = (password: string) =>
  hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
export const verifyPassword = (encoded: string, password: string) => verify(encoded, password);
