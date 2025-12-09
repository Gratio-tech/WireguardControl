import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT = 'wg-control::client-secret';

const bufferToBase64 = (buffer: Buffer): string => buffer.toString('base64');
const base64ToBuffer = (input: string): Buffer => Buffer.from(input, 'base64');

const getKey = (pass: string): Buffer => {
  if (!pass || pass.length < 8) {
    throw new Error('Encryption passphrase must be at least 8 characters long.');
  }
  return scryptSync(pass, SALT, 32);
};

export const encryptSecret = (payload: string, pass: string): string => {
  const key = getKey(pass);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return bufferToBase64(Buffer.concat([iv, authTag, encrypted]));
};

export const decryptSecret = (payload: string, pass: string): string => {
  const key = getKey(pass);
  const bufferPayload = base64ToBuffer(payload);
  const iv = bufferPayload.subarray(0, IV_LENGTH);
  const authTag = bufferPayload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = bufferPayload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};

export const generateRuntimeCode = (length = 48): string => {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};
