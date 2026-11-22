/**
 * Umzug vorhandener Dateien einer Inhaltsart zu einem anderen Speicherort
 * (Verwaltung → Speicher). Läuft im Anwendungsprozess, eine Datei nach der
 * anderen: verschlüsselten Inhalt kopieren, am Ziel zurücklesen und per
 * Prüfsumme vergleichen, erst dann umstellen und am alten Ort löschen.
 * Nach einem Neustart läuft ein offener Umzug weiter.
 */
import { createHash } from 'node:crypto';
import { and, asc, eq, gt, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { files, storageMoves } from '../db/schema.ts';
import { objektLesen, objektLoeschen, objektSchreiben } from './speicherorte.ts';
import type { Kategorie } from '../../speicher.ts';

export class UmzugFehler extends Error {}

const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** Dateien der Inhaltsart, die noch nicht am Ziel liegen */
function nichtAmZiel(category: string, targetId: string | null) {
	return and(
		eq(files.category, category),
		targetId
			? or(isNull(files.storageTargetId), ne(files.storageTargetId, targetId))
			: sql`${files.storageTargetId} is not null`
	);
}

export async function umzugStarten(category: Kategorie, targetId: string | null, personId: string) {
	const [laufend] = await db
		.select({ id: storageMoves.id })
		.from(storageMoves)
		.where(and(eq(storageMoves.category, category), eq(storageMoves.status, 'laufend')));
	if (laufend) throw new UmzugFehler('Für diese Inhaltsart läuft schon ein Umzug.');
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(files)
		.where(nichtAmZiel(category, targetId));
	const [zeile] = await db
		.insert(storageMoves)
		.values({
			category,
			targetId,
			total: n,
			status: n === 0 ? 'fertig' : 'laufend',
			finishedAt: n === 0 ? new Date() : null,
			startedBy: personId
		})
		.returning({ id: storageMoves.id });
	if (n > 0) void umzugArbeiten();
	return zeile.id;
}

export async function umzugAbbrechen(id: string) {
	await db
		.update(storageMoves)
		.set({ status: 'abgebrochen', finishedAt: new Date() })
		.where(and(eq(storageMoves.id, id), eq(storageMoves.status, 'laufend')));
}

/** Eine Datei umziehen. true = umgezogen, false = gab es nicht mehr. */
export async function dateiUmziehen(
	id: string,
	von: string | null,
	nach: string | null
): Promise<boolean> {
	const inhalt = await objektLesen(von, id);
	const soll = hash(inhalt);
	// Rest eines abgebrochenen Versuchs am Ziel entfernen (lokal wird nie überschrieben)
	await objektLoeschen(nach, id).catch(() => undefined);
	await objektSchreiben(nach, id, inhalt);
	const zurueck = await objektLesen(nach, id);
	if (hash(zurueck) !== soll) {
		await objektLoeschen(nach, id).catch(() => undefined);
		throw new UmzugFehler('Prüfsumme am Ziel weicht ab');
	}
	const umgestellt = await db
		.update(files)
		.set({ storageTargetId: nach })
		.where(
			and(eq(files.id, id), von ? eq(files.storageTargetId, von) : isNull(files.storageTargetId))
		)
		.returning({ id: files.id });
	if (umgestellt.length === 0) {
		// Inzwischen gelöscht oder schon umgestellt: Kopie am Ziel wieder entfernen
		await objektLoeschen(nach, id).catch(() => undefined);
		return false;
	}
	await objektLoeschen(von, id).catch(() => undefined);
	return true;
}

let arbeitet: Promise<void> | null = null;

/** Offene Umzüge abarbeiten (läuft nur einmal; ein zweiter Aufruf wartet auf den ersten). */
export function umzugArbeiten(): Promise<void> {
	arbeitet ??= abarbeiten().finally(() => {
		arbeitet = null;
	});
	return arbeitet;
}

async function abarbeiten(): Promise<void> {
	for (;;) {
		const [m] = await db
			.select()
			.from(storageMoves)
			.where(eq(storageMoves.status, 'laufend'))
			.orderBy(asc(storageMoves.startedAt))
			.limit(1);
		if (!m) return;
		const fehlgeschlagen: string[] = [];
		let letzte = '';
		let fehlerText: string | null = null;
		for (;;) {
			const [stand] = await db
				.select({ status: storageMoves.status })
				.from(storageMoves)
				.where(eq(storageMoves.id, m.id));
			if (stand?.status !== 'laufend') break;
			const [f] = await db
				.select({ id: files.id, ziel: files.storageTargetId })
				.from(files)
				.where(
					and(
						nichtAmZiel(m.category, m.targetId),
						gt(files.id, letzte || '00000000-0000-0000-0000-000000000000'),
						fehlgeschlagen.length ? notInArray(files.id, fehlgeschlagen) : undefined
					)
				)
				.orderBy(asc(files.id))
				.limit(1);
			if (!f) {
				await db
					.update(storageMoves)
					.set({
						status: fehlgeschlagen.length ? 'fehler' : 'fertig',
						message: fehlgeschlagen.length
							? `${fehlgeschlagen.length} Dateien konnten nicht umgezogen werden${fehlerText ? `: ${fehlerText}` : ''}. Sie liegen weiter am alten Ort.`
							: null,
						finishedAt: new Date()
					})
					.where(eq(storageMoves.id, m.id));
				break;
			}
			letzte = f.id;
			try {
				await dateiUmziehen(f.id, f.ziel, m.targetId);
				await db
					.update(storageMoves)
					.set({ done: sql`${storageMoves.done} + 1` })
					.where(eq(storageMoves.id, m.id));
			} catch (err) {
				fehlgeschlagen.push(f.id);
				fehlerText = err instanceof Error ? err.message.slice(0, 120) : null;
				await db
					.update(storageMoves)
					.set({ failed: sql`${storageMoves.failed} + 1` })
					.where(eq(storageMoves.id, m.id));
			}
		}
	}
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Beim Start: offene Umzüge fortsetzen und regelmäßig nachsehen. */
export function startUmzuege() {
	if (timer) return;
	void umzugArbeiten().catch((err) => console.error('Umzug der Dateien:', err?.message));
	timer = setInterval(() => {
		void umzugArbeiten().catch((err) => console.error('Umzug der Dateien:', err?.message));
	}, 60_000);
	timer.unref?.();
}
