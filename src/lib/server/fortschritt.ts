/**
 * „Weiter, wo du warst“ (Kap. 8.15): Position je Person und Video am Konto.
 * Gespeichert werden nur Sekunde und Datum der letzten Änderung, kein Verlauf
 * und nichts im Protokoll. Lesen und Schreiben über scoped() (Row-Level
 * Security: nur die eigene Person); keine Auswertung für andere.
 */
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { Principal } from './auth/access.ts';
import { db, scoped } from './db/index.ts';
import { personPreferences, units, videoProgress, videos } from './db/schema.ts';
import { sichtbar } from './mediathek.ts';

/** Unter dieser Position lohnt kein Merken; so nah am Ende gilt als zu Ende gesehen */
const MIN_SEK = 5;
const REST_SEK = 15;
export const AUFBEWAHRUNG_TAGE = 90;
/** Rest, ab dem ein Video als gesehen gilt: 15 Sekunden, bei kurzen Videos ein Zehntel */
export const restSek = (dauer: number) => Math.min(REST_SEK, dauer * 0.1);

export async function fortschrittAn(personId: string): Promise<boolean> {
	const [r] = await db
		.select({ an: personPreferences.videoProgress })
		.from(personPreferences)
		.where(eq(personPreferences.personId, personId));
	return r?.an ?? true;
}

/** Schalter im Konto; ausschalten löscht den gespeicherten Stand */
export async function fortschrittSchalten(p: Principal, an: boolean) {
	await db
		.insert(personPreferences)
		.values({ personId: p.personId, videoProgress: an })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { videoProgress: an } });
	if (!an) await fortschrittLoeschen(p);
}

export async function fortschrittLoeschen(p: Principal): Promise<number> {
	const r = await scoped(p, (tx) =>
		tx
			.delete(videoProgress)
			.where(eq(videoProgress.personId, p.personId))
			.returning({ id: videoProgress.videoId })
	);
	return r.length;
}

/** Gespeicherte Position (null = keine oder Schalter aus) */
export async function position(p: Principal, videoId: string): Promise<number | null> {
	const [r] = await scoped(p, (tx) =>
		tx
			.select({ s: videoProgress.positionSec })
			.from(videoProgress)
			.where(and(eq(videoProgress.personId, p.personId), eq(videoProgress.videoId, videoId)))
	);
	return r?.s ?? null;
}

/**
 * Stand merken. Am Ende (oder fast) wird der Eintrag gelöscht, ganz am Anfang
 * gar nicht erst angelegt. false = nicht sichtbar oder Schalter aus.
 */
export async function merken(p: Principal, videoId: string, sek: number): Promise<boolean> {
	if (!Number.isFinite(sek) || sek < 0) return false;
	if (!(await fortschrittAn(p.personId))) return false;
	const s = await sichtbar(p, videoId);
	if (!s || !['entwurf', 'veroeffentlicht'].includes(s.v.status)) return false;
	const dauer = s.v.durationSec;
	const pos = Math.floor(sek);
	await scoped(p, async (tx) => {
		const weg = and(eq(videoProgress.personId, p.personId), eq(videoProgress.videoId, videoId));
		if (pos < MIN_SEK || (dauer > 0 && pos >= dauer - restSek(dauer))) {
			await tx.delete(videoProgress).where(weg);
			return;
		}
		await tx
			.insert(videoProgress)
			.values({ personId: p.personId, videoId, positionSec: pos })
			.onConflictDoUpdate({
				target: [videoProgress.personId, videoProgress.videoId],
				set: { positionSec: pos, updatedAt: new Date() }
			});
	});
	return true;
}

/** „Weiter ansehen“: eigene angefangene, veröffentlichte Videos */
export async function weiterAnsehen(p: Principal, limit = 6) {
	if (!(await fortschrittAn(p.personId))) return [];
	return scoped(p, (tx) =>
		tx
			.select({
				id: videos.id,
				title: videos.title,
				unitName: units.name,
				durationSec: videos.durationSec,
				positionSec: videoProgress.positionSec
			})
			.from(videoProgress)
			.innerJoin(videos, eq(videos.id, videoProgress.videoId))
			.innerJoin(units, eq(units.id, videos.unitId))
			.where(and(eq(videoProgress.personId, p.personId), eq(videos.status, 'veroeffentlicht')))
			.orderBy(desc(videoProgress.updatedAt))
			.limit(limit)
	);
}

/** Aufräumen (cleanup): Stand älter als 90 Tage löschen */
export async function alterFortschrittLoeschen() {
	await db
		.delete(videoProgress)
		.where(lt(videoProgress.updatedAt, sql`now() - make_interval(days => ${AUFBEWAHRUNG_TAGE})`));
}
