/**
 * Verschlüsselung kleiner Geheimnisse (z. B. TOTP-Schlüssel) mit AES-256-GCM.
 * Schlüssel: ENCRYPTION_KEY, 32 Byte als base64 (erzeugen: openssl rand -base64 32).
 * Format: v1.<iv>.<tag>.<ciphertext>, jeweils base64url.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function loadKey(raw = process.env.ENCRYPTION_KEY): Buffer {
	if (!raw) throw new Error('ENCRYPTION_KEY ist nicht gesetzt');
	const key = Buffer.from(raw, 'base64');
	if (key.length !== 32) throw new Error('ENCRYPTION_KEY muss 32 Byte (base64) lang sein');
	return key;
}

export function encryptSecret(plain: Uint8Array, rawKey?: string): string {
	const key = loadKey(rawKey);
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
	const tag = cipher.getAuthTag();
	return ['v1', iv, tag, enc]
		.map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
		.join('.');
}

export function decryptSecret(value: string, rawKey?: string): Uint8Array {
	const [version, iv, tag, enc] = value.split('.');
	if (version !== 'v1' || !iv || !tag || enc === undefined) throw new Error('Unbekanntes Format');
	// Tag-Länge fest: ein gekürzter Tag würde sonst angenommen
	const decipher = createDecipheriv('aes-256-gcm', loadKey(rawKey), Buffer.from(iv, 'base64url'), {
		authTagLength: 16
	});
	decipher.setAuthTag(Buffer.from(tag, 'base64url'));
	return new Uint8Array(
		Buffer.concat([decipher.update(Buffer.from(enc, 'base64url')), decipher.final()])
	);
}

export function sha256Hex(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

/** Zufälliges Token für Links und Cookies. */
export function randomToken(bytes = 32): string {
	return randomBytes(bytes).toString('base64url');
}
