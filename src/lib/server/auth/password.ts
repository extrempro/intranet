import { createHash } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id (Standard von @node-rs/argon2) mit den OWASP-Werten:
 * 19 MiB Speicher, 2 Durchläufe, 1 Thread.
 */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };

export function hashPassword(password: string): Promise<string> {
	return hash(password.normalize('NFC'), OPTIONS);
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
	try {
		return await verify(hashValue, password.normalize('NFC'));
	} catch {
		return false;
	}
}

/** Für unbekannte Konten dieselbe Rechenzeit verbrauchen (kein Erraten über Laufzeit). */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordTime(password: string): Promise<void> {
	dummyHash ??= hashPassword('nicht-vorhandenes-konto-platzhalter');
	await verifyPassword(await dummyHash, password);
}

/**
 * Prüfung gegen Have I Been Pwned per k-Anonymität: Nur die ersten 5 Zeichen
 * des SHA-1 verlassen den Server, mit Padding gegen Auswertung der Antwortgröße.
 * @returns true = bekannt, false = nicht bekannt, null = Dienst nicht erreichbar
 */
export async function isPwnedPassword(password: string): Promise<boolean | null> {
	const sha1 = createHash('sha1').update(password.normalize('NFC')).digest('hex').toUpperCase();
	const prefix = sha1.slice(0, 5);
	const suffix = sha1.slice(5);
	try {
		const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
			headers: { 'Add-Padding': 'true', 'User-Agent': 'intranet (github.com/extrempro/intranet)' },
			signal: AbortSignal.timeout(3000),
			redirect: 'error'
		});
		if (!res.ok) return null;
		const body = await res.text();
		for (const line of body.split('\n')) {
			const [s, count] = line.trim().split(':');
			if (s === suffix) return Number(count) > 0;
		}
		return false;
	} catch {
		return null;
	}
}
