/**
 * Verschlüsselung je Datei (Kap. 1.4, 16): eigener Schlüssel je Datei (AES-256-GCM),
 * der Dateischlüssel liegt mit dem Hauptschlüssel (ENCRYPTION_KEY) geschützt in der
 * Datenbank. Löschen des Schlüssels macht die Datei unlesbar (Kap. 15).
 * Die Datei-ID ist als zusätzliche Authentisierung gebunden: vertauschte Dateien
 * lassen sich nicht entschlüsseln.
 * Format auf der Platte: „IF1“ | IV (12) | Tag (16) | Chiffrat
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret } from '../crypto.ts';

const MAGIC = Buffer.from('IF1');

export function newFileKey(): { key: Buffer; keyEnc: string } {
	const key = randomBytes(32);
	return { key, keyEnc: encryptSecret(key) };
}

export function unwrapFileKey(keyEnc: string): Buffer {
	return Buffer.from(decryptSecret(keyEnc));
}

export function encryptFile(plain: Uint8Array, key: Buffer, fileId: string): Buffer {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	cipher.setAAD(Buffer.from(fileId));
	const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
	return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), enc]);
}

export function decryptFile(data: Buffer, key: Buffer, fileId: string): Buffer {
	if (!data.subarray(0, 3).equals(MAGIC)) throw new Error('Unbekanntes Dateiformat');
	const iv = data.subarray(3, 15);
	const tag = data.subarray(15, 31);
	const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
	decipher.setAAD(Buffer.from(fileId));
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(data.subarray(31)), decipher.final()]);
}
