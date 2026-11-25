/**
 * Seite einer Abteilung (auch Geschäftsführung, Stabsstelle) wie bei Hubs
 * (Kap. 8.11): Aufbau (Reiter, Blöcke im Überblick), Schnellzugriff und
 * Dokumente. Pflegen dürfen Abteilungsverwaltung, Redaktion (ohne eigene
 * Pflege) und Verwaltung; Dokumente auch, wer das Recht „Dokumente“ hat.
 */
import { eq } from 'drizzle-orm';
import { cleanLayout, type HubLayout } from '../hubs.ts';
import { audit } from './audit.ts';
import type { Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import { units } from './db/schema.ts';
import { dokumenteSpeichern, hubDatenLesen, linksErsetzen, linksPruefen } from './hub-pflege.ts';
import { HubError, seitePflegbar } from './hubs.ts';

export interface SeitenDaten {
	aufbau: HubLayout;
	links: ReturnType<typeof hubDatenLesen>['links'];
	dokumente: ReturnType<typeof hubDatenLesen>['dokumente'];
	interneOrdner?: string[];
}

/** JSON aus dem Formular lesen (Längen und Anzahlen begrenzt wie bei Hubs) */
export function seitenDatenLesen(roh: string): SeitenDaten {
	const d = hubDatenLesen(roh);
	let aufbau: unknown;
	try {
		aufbau = (JSON.parse(roh) as { aufbau?: unknown }).aufbau ?? null;
	} catch {
		aufbau = null;
	}
	return {
		aufbau: cleanLayout(aufbau, 'abteilung'),
		links: d.links,
		dokumente: d.dokumente,
		interneOrdner: d.interneOrdner
	};
}

/** Aufbau, Schnellzugriff und Dokumente in einem Schritt übernehmen */
export async function einheitSeiteSpeichern(
	p: Principal,
	unitId: string,
	d: SeitenDaten,
	neueDateien: string[],
	ip: string
): Promise<{ fehler?: string }> {
	const u = await seitePflegbar(p, unitId);
	if (u.type === 'hub') return { fehler: 'Hubs pflegst du unter „Hub bearbeiten“.' };
	try {
		// Zuerst prüfen, damit nichts halb gespeichert wird
		const links = linksPruefen(unitId, d.links);
		await linksErsetzen(unitId, links);
		await dokumenteSpeichern(p, unitId, d.dokumente, neueDateien, d.interneOrdner);
		await db.update(units).set({ pageLayout: d.aufbau }).where(eq(units.id, unitId));
	} catch (err) {
		if (err instanceof HubError) return { fehler: err.message };
		throw err;
	}
	await audit({
		category: 'admin',
		action: 'unit.page_save',
		actorId: p.personId,
		tenantId: u.tenantId,
		entityType: 'unit',
		entityId: unitId,
		ip
	});
	return {};
}
