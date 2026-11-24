/**
 * Eingriffe der Redaktion (Kap. 10): bei fremden Beiträgen das Anheften
 * lösen, „Dringend“ beenden oder den Beitrag vorzeitig ablaufen lassen;
 * veröffentlichte Videos zurückziehen. Alles wird protokolliert. Löschen
 * bleibt bei der Einheit.
 */
import { eq, sql } from 'drizzle-orm';
import { audit } from './audit.ts';
import { editorialTenants, type Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import { faqs, news, newsTenants, units, videos } from './db/schema.ts';

export class EingriffFehler extends Error {}

const GUID = /^[0-9a-f-]{36}$/i;

/**
 * Darf die Redaktion hier eingreifen? Redaktion für alle immer; Redaktion je
 * Mandant, wenn der Inhalt aus einem ihrer Mandanten kommt oder nur an ihre
 * Mandanten gerichtet ist.
 */
export function imBereich(
	p: Principal,
	inhalt: { tenantId: string; allTenants: boolean; ziele: string[] }
): boolean {
	const red = editorialTenants(p);
	if (red === 'alle') return true;
	if (!red.length) return false;
	if (red.includes(inhalt.tenantId)) return true;
	return (
		!inhalt.allTenants && inhalt.ziele.length > 0 && inhalt.ziele.every((t) => red.includes(t))
	);
}

async function beitragImBereich(p: Principal, id: string) {
	if (!GUID.test(id)) return null;
	const [n] = await db.select().from(news).where(eq(news.id, id));
	if (!n) return null;
	const ziele = (
		await db.select({ t: newsTenants.tenantId }).from(newsTenants).where(eq(newsTenants.newsId, id))
	).map((r) => r.t);
	return imBereich(p, { tenantId: n.tenantId, allTenants: n.allTenants, ziele }) ? n : null;
}

/** Für die Anzeige: Darf die Redaktion bei diesem Beitrag eingreifen? */
export async function beitragEingreifbar(p: Principal, id: string): Promise<boolean> {
	return Boolean(await beitragImBereich(p, id));
}

export type BeitragEingriff = 'loesen' | 'dringend' | 'beenden';

export async function beitragEingreifen(
	p: Principal,
	id: string,
	art: BeitragEingriff,
	ip: string
) {
	const n = await beitragImBereich(p, id);
	if (!n) throw new EingriffFehler('Dafür fehlt dir das Recht.');
	const jetzt = new Date();
	if (art === 'loesen') {
		if (!n.pinnedUntil || n.pinnedUntil <= jetzt)
			throw new EingriffFehler('Der Beitrag ist nicht angeheftet.');
		await db
			.update(news)
			.set({ pinnedUntil: null, pinnedByEditorial: false })
			.where(eq(news.id, id));
	} else if (art === 'dringend') {
		if (!n.urgentUntil || n.urgentUntil <= jetzt)
			throw new EingriffFehler('Der Beitrag ist keine dringende Meldung mehr.');
		// „War dringend bis …“ bleibt sichtbar
		await db.update(news).set({ urgentUntil: jetzt }).where(eq(news.id, id));
	} else {
		if (n.expiresAt && n.expiresAt <= jetzt)
			throw new EingriffFehler('Der Beitrag ist schon abgelaufen.');
		await db
			.update(news)
			.set({
				expiresAt: jetzt,
				pinnedUntil: null,
				pinnedByEditorial: false,
				urgentUntil: n.urgentUntil && n.urgentUntil > jetzt ? jetzt : n.urgentUntil
			})
			.where(eq(news.id, id));
	}
	await audit({
		category: 'admin',
		action: `news.redaktion_${art}`,
		actorId: p.personId,
		tenantId: n.tenantId,
		entityType: 'news',
		entityId: id,
		details: { unitId: n.unitId },
		ip
	});
}

async function videoImBereich(p: Principal, id: string) {
	if (!GUID.test(id)) return null;
	const [v] = await db
		.select({
			id: videos.id,
			status: videos.status,
			unitId: videos.unitId,
			tenantIds: videos.tenantIds,
			unitTenantId: units.tenantId
		})
		.from(videos)
		.innerJoin(units, eq(units.id, videos.unitId))
		.where(eq(videos.id, id));
	if (!v) return null;
	// Leer = alle Mandanten (nur zentrale Einheiten schränken ein)
	const ziele = v.tenantIds ?? [];
	return imBereich(p, { tenantId: v.unitTenantId, allTenants: ziele.length === 0, ziele })
		? v
		: null;
}

export async function videoEingreifbar(p: Principal, id: string): Promise<boolean> {
	const v = await videoImBereich(p, id);
	return Boolean(v && v.status === 'veroeffentlicht');
}

/** Veröffentlichtes Video zurückziehen: wieder Entwurf, die Einheit kann es erneut veröffentlichen. */
export async function videoZurueckziehen(p: Principal, id: string, ip: string) {
	const v = await videoImBereich(p, id);
	if (!v) throw new EingriffFehler('Dafür fehlt dir das Recht.');
	if (v.status !== 'veroeffentlicht')
		throw new EingriffFehler('Das Video ist nicht veröffentlicht.');
	await db
		.update(videos)
		.set({ status: 'entwurf', updatedAt: new Date() })
		.where(eq(videos.id, id));
	await audit({
		category: 'admin',
		action: 'video.redaktion_zurueckziehen',
		actorId: p.personId,
		tenantId: v.unitTenantId,
		entityType: 'video',
		entityId: id,
		details: { unitId: v.unitId },
		ip
	});
}

/**
 * Lange nicht geänderte FAQ als „noch aktuell“ bestätigen, ohne sie zu ändern.
 * Gilt für FAQs der eigenen Mandanten und zentraler Einheiten (wie die Arbeitsliste).
 */
export async function faqNochAktuell(p: Principal, id: string, ip: string) {
	if (!GUID.test(id)) throw new EingriffFehler('FAQ nicht gefunden.');
	const [f] = await db
		.select({ id: faqs.id, tenantId: units.tenantId, isCentral: units.isCentral })
		.from(faqs)
		.innerJoin(units, eq(units.id, faqs.unitId))
		.where(eq(faqs.id, id));
	const red = editorialTenants(p);
	const darf =
		f && (red === 'alle' || (red.length > 0 && (f.isCentral || red.includes(f.tenantId))));
	if (!darf) throw new EingriffFehler('Dafür fehlt dir das Recht.');
	// „Zuletzt geändert“ bleibt, wie es ist
	await db
		.update(faqs)
		.set({ checkedAt: new Date(), updatedAt: sql`${faqs.updatedAt}` })
		.where(eq(faqs.id, id));
	await audit({
		category: 'admin',
		action: 'faq.redaktion_geprueft',
		actorId: p.personId,
		tenantId: f.tenantId,
		entityType: 'faq',
		entityId: id,
		ip
	});
}
