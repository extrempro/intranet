/**
 * Videos in Teilen hochladen (Kap. 8.15), im Browser. Genutzt beim ersten
 * Hochladen, beim Fortsetzen nach einem Abbruch und für eine neue Fassung.
 */
import { TEIL_BYTES } from './mediathek.ts';

export class HochladenFehler extends Error {}

/** SHA-256 des ersten Teils (wie der Server ihn speichert), hex */
export async function kopfPruefsumme(datei: Blob): Promise<string> {
	const teil = await datei.slice(0, Math.min(datei.size, TEIL_BYTES)).arrayBuffer();
	const h = await crypto.subtle.digest('SHA-256', teil);
	return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sendet die Datei ab Byte `ab` in Teilen. Jeder Teil wird bis zu dreimal
 * versucht; der Server bestätigt jeweils den neuen Stand.
 */
export async function teileSenden(
	id: string,
	datei: Blob,
	ab: number,
	fortschritt: (gesendet: number) => void
): Promise<void> {
	let gesendet = ab;
	fortschritt(gesendet);
	while (gesendet < datei.size) {
		const teil = datei.slice(gesendet, Math.min(datei.size, gesendet + TEIL_BYTES));
		let ok = false;
		let meldung = '';
		for (let versuch = 0; versuch < 3 && !ok; versuch++) {
			const t = await fetch(`/mediathek/${id}/teil?offset=${gesendet}`, {
				method: 'PUT',
				body: teil
			}).catch(() => null);
			const a = (await t?.json().catch(() => ({}))) as
				{ erhalten?: number; fehler?: string } | undefined;
			if (t?.ok && typeof a?.erhalten === 'number') {
				gesendet = a.erhalten;
				fortschritt(gesendet);
				ok = true;
			} else {
				meldung =
					a?.fehler ??
					(t?.status === 413
						? 'Der Server nimmt die Teile nicht an (zu groß). Wende dich bitte an die IT.'
						: 'Die Verbindung ist unterbrochen. Du kannst das Hochladen später fortsetzen.');
				if (t && t.status < 500) break;
				await new Promise((w) => setTimeout(w, 2000 * (versuch + 1)));
			}
		}
		if (!ok) throw new HochladenFehler(meldung);
	}
}

/** JSON an einen Endpunkt der Mediathek senden; Fehlertext des Servers weiterreichen */
export async function anfragen<T>(adresse: string, daten: unknown): Promise<T> {
	const r = await fetch(adresse, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(daten)
	}).catch(() => null);
	const j = (await r?.json().catch(() => ({}))) as T & { fehler?: string };
	if (!r?.ok)
		throw new HochladenFehler(j?.fehler ?? 'Das hat nicht geklappt. Versuch es bitte noch einmal.');
	return j;
}

/** Stand eines abgebrochenen Uploads abfragen und prüfen, ob es dieselbe Datei ist */
export async function fortsetzenAb(id: string, datei: File): Promise<number> {
	const r = await fetch(`/mediathek/${id}/teil`).catch(() => null);
	const s = (await r?.json().catch(() => ({}))) as {
		erhalten?: number;
		groesse?: number;
		kopf?: string | null;
		fehler?: string;
	};
	if (!r?.ok || typeof s.erhalten !== 'number')
		throw new HochladenFehler(s?.fehler ?? 'Der Stand lässt sich nicht abrufen.');
	if (s.groesse !== datei.size)
		throw new HochladenFehler(
			'Das ist nicht dieselbe Datei (andere Größe). Wähle die ursprüngliche Datei.'
		);
	if (s.erhalten > 0 && s.kopf && s.kopf !== (await kopfPruefsumme(datei)))
		throw new HochladenFehler('Das ist nicht dieselbe Datei. Wähle die ursprüngliche Datei.');
	return s.erhalten;
}
