/**
 * Mediathek (Kap. 8.15): Vorschlag für Zusammenfassung und Kapitel aus den
 * Untertiteln. Das Sprachmodell läuft lokal im Dienst video (ohne Netz);
 * Austausch über den Arbeitsordner:
 *   <ARBEIT>/vorschlag-<id>/eingabe.txt   Untertitel mit Zeitmarken (schreibt die Anwendung)
 *   <ARBEIT>/vorschlag-<id>/auftrag       Auftrag liegt vor (schreibt die Anwendung)
 *   <ARBEIT>/vorschlag-<id>/laeuft        wird gerade erstellt
 *   <ARBEIT>/vorschlag-<id>/ergebnis.json Antwort des Modells (JSON)
 *   <ARBEIT>/vorschlag-<id>/fehler        kurze Meldung
 * Der Vorschlag wird nie von selbst übernommen.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import type { Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import { videos } from './db/schema.ts';
import {
	arbeitsOrdner,
	cuesAus,
	MediathekFehler,
	ohneMarkup,
	untertitelBereit,
	zumBearbeiten
} from './mediathek.ts';
import { notify } from './notify.ts';
import { kapitelFehler, MAX_BESCHREIBUNG, zeitLesen, zeitText } from '../mediathek.ts';

/** Höchstens so viele Zeichen Untertitel gehen an das Modell (etwa 20 000 Tokens) */
export const MAX_EINGABE = 60_000;
/** Höchstens so viele vorgeschlagene Kapitel */
export const MAX_VORSCHLAG_KAPITEL = 20;

export interface Vorschlag {
	zusammenfassung: string;
	kapitel: { s: number; t: string }[];
	/** Aus noch nicht geprüften automatischen Untertiteln */
	ungeprueft?: boolean;
}

/** Mindestlänge der Untertitel für einen Vorschlag */
const MIN_EINGABE = 20;

export function vorschlagOrdner(id: string): string {
	return join(arbeitsOrdner(), `vorschlag-${id}`);
}

/** „00:01:02.500“ oder „01:02.500“ in Sekunden (abgerundet) */
function vttSekunden(t: string): number {
	const m = /^(?:(\d+):)?(\d{2}):(\d{2})(?:\.\d+)?$/.exec(t);
	return m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number.NaN;
}

/**
 * Untertitel als Zeilen „[m:ss] Text“. Zu lange Fassungen werden gleichmäßig
 * ausgedünnt (jede n-te Zeile), damit sie in den Kontext des Modells passen.
 */
export function vorschlagEingabe(vtt: string | null): string {
	const zeilen = cuesAus(vtt)
		.map((c) => ({ s: vttSekunden(c.a), t: c.t.replace(/\s+/g, ' ').trim() }))
		.filter((c) => Number.isFinite(c.s) && c.t)
		.map((c) => `[${zeitText(c.s)}] ${c.t}`);
	let liste = zeilen;
	const laenge = zeilen.reduce((n, z) => n + z.length + 1, 0);
	if (laenge > MAX_EINGABE) {
		const schritt = Math.ceil(laenge / MAX_EINGABE);
		liste = zeilen.filter((_, i) => i % schritt === 0);
	}
	return liste.join('\n');
}

/**
 * Antwort des Modells prüfen: Zusammenfassung als reiner Text, Kapitel mit
 * gültigen Zeiten (aufsteigend, im Video, erstes bei 0:00). null = unbrauchbar.
 */
export function vorschlagLesen(roh: string, dauer: number): Vorschlag | null {
	const a = roh.indexOf('{');
	const b = roh.lastIndexOf('}');
	if (a < 0 || b <= a) return null;
	let j: unknown;
	try {
		j = JSON.parse(roh.slice(a, b + 1));
	} catch {
		return null;
	}
	if (!j || typeof j !== 'object') return null;
	const o = j as Record<string, unknown>;
	const zusammenfassung = ohneMarkup(String(o.zusammenfassung ?? ''))
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
		.slice(0, MAX_BESCHREIBUNG);
	const roheKapitel = Array.isArray(o.kapitel) ? o.kapitel : [];
	const kandidaten = roheKapitel
		.map((k) => {
			const x = (k ?? {}) as Record<string, unknown>;
			const s =
				typeof x.start === 'number' ? Math.floor(x.start) : zeitLesen(String(x.start ?? ''));
			const t = ohneMarkup(String(x.titel ?? ''))
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 120);
			return { s, t };
		})
		.filter((k) => Number.isFinite(k.s) && k.s >= 0 && k.t && (dauer <= 0 || k.s < dauer))
		.sort((x, y) => x.s - y.s);
	const kapitel: { s: number; t: string }[] = [];
	for (const k of kandidaten) {
		if (kapitel.length >= MAX_VORSCHLAG_KAPITEL) break;
		if (kapitel.length && k.s <= kapitel[kapitel.length - 1].s) continue;
		kapitel.push(k);
	}
	// Das erste Kapitel beginnt bei 0:00
	if (kapitel.length) kapitel[0] = { ...kapitel[0], s: 0 };
	const gueltig = kapitelFehler(kapitel, dauer).every((f) => !f) ? kapitel : [];
	if (!zusammenfassung && !gueltig.length) return null;
	return { zusammenfassung, kapitel: gueltig.length > 1 ? gueltig : [] };
}

/** Vorschlag anfordern: erst mit fertigen (und, wenn automatisch, geprüften) Untertiteln */
export async function vorschlagAnfordern(p: Principal, id: string) {
	const { v } = await zumBearbeiten(p, id);
	if (!['entwurf', 'veroeffentlicht'].includes(v.status))
		throw new MediathekFehler('Das Video ist noch nicht fertig umgewandelt.');
	if (!v.captionsVtt)
		throw new MediathekFehler('Für einen Vorschlag braucht das Video Untertitel.');
	if (!untertitelBereit(v))
		throw new MediathekFehler('Prüfe zuerst die Untertitel, dann kann ein Vorschlag entstehen.');
	if (v.suggestionStatus === 'warten')
		throw new MediathekFehler('Der Vorschlag wird schon erstellt.');
	if (vorschlagEingabe(v.captionsVtt).length < MIN_EINGABE)
		throw new MediathekFehler('Die Untertitel sind zu kurz für einen Vorschlag.');
	await vorschlagStarten(id, p.personId, v.captionsVtt, false);
}

/**
 * Auftrag an den Dienst video schreiben. Ohne Prüfung der Rechte: Aufrufer sind
 * vorschlagAnfordern und die Umwandlung (Vorschlag beim Hochladen gewählt).
 * false = Untertitel zu kurz, kein Auftrag.
 */
export async function vorschlagStarten(
	id: string,
	personId: string | null,
	vtt: string,
	ungeprueft: boolean
): Promise<boolean> {
	const eingabe = vorschlagEingabe(vtt);
	if (eingabe.length < MIN_EINGABE) return false;
	const ordner = vorschlagOrdner(id);
	await rm(ordner, { recursive: true, force: true });
	await mkdir(ordner, { recursive: true, mode: 0o700 });
	await writeFile(join(ordner, 'eingabe.txt'), `${eingabe}\n`, { mode: 0o600 });
	await writeFile(join(ordner, 'auftrag'), '', { mode: 0o600 });
	await db
		.update(videos)
		.set({
			suggestionStatus: 'warten',
			// Bis zum Ergebnis merkt sich der Vorschlag nur, worauf er beruht
			suggestion: ungeprueft ? { zusammenfassung: '', kapitel: [], ungeprueft: true } : null,
			suggestionError: null,
			suggestionBy: personId,
			suggestionAt: new Date()
		})
		.where(eq(videos.id, id));
	return true;
}

async function lies(pfad: string): Promise<string | null> {
	try {
		return await readFile(pfad, 'utf8');
	} catch {
		return null;
	}
}

/** Ergebnisse aus dem Arbeitsordner abholen (läuft mit der Umwandlung alle 5 Sekunden) */
export async function vorschlaegeAbholen() {
	const offen = await db
		.select({
			id: videos.id,
			title: videos.title,
			durationSec: videos.durationSec,
			suggestion: videos.suggestion,
			suggestionBy: videos.suggestionBy
		})
		.from(videos)
		.where(eq(videos.suggestionStatus, 'warten'));
	for (const v of offen) {
		const ordner = vorschlagOrdner(v.id);
		const fehler = await lies(join(ordner, 'fehler'));
		const ergebnis = fehler === null ? await lies(join(ordner, 'ergebnis.json')) : null;
		let neu: Partial<typeof videos.$inferInsert> | null = null;
		if (fehler !== null) {
			neu = { suggestionStatus: 'fehler', suggestionError: fehler.trim().slice(0, 200) };
		} else if (ergebnis !== null) {
			const vorschlag = vorschlagLesen(ergebnis, v.durationSec);
			neu = vorschlag
				? {
						suggestionStatus: 'fertig',
						suggestion: v.suggestion?.ungeprueft ? { ...vorschlag, ungeprueft: true } : vorschlag
					}
				: {
						suggestionStatus: 'fehler',
						suggestionError: 'Aus der Antwort ließ sich kein Vorschlag machen.'
					};
		} else if ((await lies(join(ordner, 'auftrag'))) === null) {
			neu = {
				suggestionStatus: 'fehler',
				suggestionError: 'Der Auftrag ist verloren gegangen. Versuch es noch einmal.'
			};
		}
		if (!neu) continue;
		// Nur übernehmen, wenn niemand inzwischen verworfen oder neu angefordert hat
		const [r] = await db
			.update(videos)
			.set(neu)
			.where(and(eq(videos.id, v.id), eq(videos.suggestionStatus, 'warten')))
			.returning({ id: videos.id });
		await rm(ordner, { recursive: true, force: true });
		if (r && v.suggestionBy)
			await notify('nachrichten', [v.suggestionBy], {
				title:
					neu.suggestionStatus === 'fertig'
						? `Der Vorschlag für „${v.title}“ ist fertig.`
						: `Für „${v.title}“ ließ sich kein Vorschlag erstellen.`,
				link: `/mediathek/${v.id}/bearbeiten`
			});
	}
}

/** Teil des Vorschlags übernehmen: ersetzt Beschreibung oder Kapitel */
export async function vorschlagUebernehmen(
	p: Principal,
	id: string,
	was: 'zusammenfassung' | 'kapitel'
) {
	const { v } = await zumBearbeiten(p, id);
	const s = v.suggestionStatus === 'fertig' ? v.suggestion : null;
	if (!s) throw new MediathekFehler('Es gibt keinen Vorschlag.');
	const rest: Vorschlag = { ...s };
	const set: Partial<typeof videos.$inferInsert> = { updatedAt: new Date() };
	if (was === 'zusammenfassung') {
		if (!s.zusammenfassung) throw new MediathekFehler('Der Vorschlag hat keine Zusammenfassung.');
		set.description = s.zusammenfassung.slice(0, MAX_BESCHREIBUNG);
		rest.zusammenfassung = '';
	} else {
		if (!s.kapitel.length) throw new MediathekFehler('Der Vorschlag hat keine Kapitel.');
		if (kapitelFehler(s.kapitel, v.durationSec).some(Boolean))
			throw new MediathekFehler('Die vorgeschlagenen Kapitel passen nicht mehr zum Video.');
		set.chapters = s.kapitel;
		rest.kapitel = [];
	}
	const leer = !rest.zusammenfassung && !rest.kapitel.length;
	await db
		.update(videos)
		.set({
			...set,
			suggestion: leer ? null : rest,
			suggestionStatus: leer ? null : 'fertig'
		})
		.where(eq(videos.id, id));
}

/** Vorschlag verwerfen (auch einen, der gerade erstellt wird) */
export async function vorschlagVerwerfen(p: Principal, id: string) {
	await zumBearbeiten(p, id);
	await db
		.update(videos)
		.set({ suggestionStatus: null, suggestion: null, suggestionError: null })
		.where(eq(videos.id, id));
	await rm(vorschlagOrdner(id), { recursive: true, force: true });
}
