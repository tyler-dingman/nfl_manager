/** Owner-operated, offline encryption of a frozen Wrangler D1 SQL export.
 * No Cloudflare credentials, network, resource creation, or SQL execution here. */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const magic = Buffer.from('DDOFFLINE1\n');
export function encryptBackup(sql, key) {
  if (key.length !== 32) throw Error('Requires a separate 32-byte backup key');
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(sql), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), data]);
}
export function decryptBackup(bytes, key) {
  if (key.length !== 32 || !bytes.subarray(0, magic.length).equals(magic))
    throw Error('Invalid backup');
  const i = magic.length,
    decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(i, i + 12));
  decipher.setAuthTag(bytes.subarray(i + 12, i + 28));
  return Buffer.concat([decipher.update(bytes.subarray(i + 28)), decipher.final()]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, input, output, keyFile] = process.argv.slice(2);
  if (!['encrypt', 'decrypt'].includes(mode) || !keyFile)
    throw Error('Usage: node scripts/no-billing-backup.mjs encrypt|decrypt INPUT OUTPUT KEY_FILE');
  const key = await readFile(keyFile),
    bytes = await readFile(input);
  await writeFile(
    output,
    mode === 'encrypt' ? encryptBackup(bytes, key) : decryptBackup(bytes, key),
    { flag: 'wx', mode: 0o600 },
  );
}
