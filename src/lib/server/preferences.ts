import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { FAVORITES_MAX, type HomeLayout } from '../home.ts';
import { db } from './db/index.ts';
import { favorites, personPreferences, tenants, units } from './db/schema.ts';
import { unitTypeLabel } from '../roles.ts';

export type Theme = 'auto' | 'hell' | 'dunkel';

export interface Preferences {
	theme: Theme;
	homeLayout: HomeLayout | null;
}

export async function getPreferences(personId: string): Promise<Preferences> {
	const [row] = await db
		.select({ theme: personPreferences.theme, homeLayout: personPreferences.homeLayout })
		.from(personPreferences)
		.where(eq(personPreferences.personId, personId));
	return row ?? { theme: 'auto', homeLayout: null };
}

export async function setTheme(personId: string, theme: Theme) {
	await db
		.insert(personPreferences)
		.values({ personId, theme })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { theme } });
}

export async function setHomeLayout(personId: string, homeLayout: HomeLayout | null) {
	await db
		.insert(personPreferences)
		.values({ personId, homeLayout })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { homeLayout } });
}

// ---------------------------------------------------------------------------
// Favoriten
// ---------------------------------------------------------------------------

export interface FavoriteTarget {
	label: string;
	description: string;
	href: string;
	icon: string;
}

/**
 * Bekannte Ziele für Favoriten. Gespeichert wird nur der Schlüssel; Adresse
 * und Bezeichnung kommen immer von hier (keine freien Links, kein Open Redirect).
 */
const UNIT_ICON = 'M3 21h18M5 21v-14l8 -4v18M19 21v-10l-6 -4';
const HUB_ICON =
	'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M19 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M19 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M6.5 6.5l4 4M17.5 6.5l-4 4M6.5 17.5l4 -4M17.5 17.5l-4 -4';
const UNIT_KEY = /^einheit:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** Favorit für eine Abteilungs- oder Hub-Seite; ob die Person sie sehen darf, prüft der Aufrufer. */
export function unitFavoriteKey(unitId: string): string {
	return `einheit:${unitId}`;
}

const TARGETS = new Map<string, FavoriteTarget>([
	[
		'abteilungen',
		{
			label: 'Abteilungen',
			description: 'Wer hilft bei was?',
			href: '/abteilungen',
			icon: UNIT_ICON
		}
	],
	[
		'kulissen',
		{
			label: 'Hinter den Kulissen',
			description: 'Einblicke aus den Abteilungen',
			href: '/hinter-den-kulissen',
			icon: 'M4 8v-2a2 2 0 0 1 2 -2h2M4 16v2a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v2M16 20h2a2 2 0 0 0 2 -2v-2M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0'
		}
	],
	[
		'hubs',
		{
			label: 'Hubs',
			description: 'Themengruppen zum Mitmachen',
			href: '/hubs',
			icon: 'M9 7a3 3 0 1 0 6 0a3 3 0 0 0 -6 0M3 21v-2a4 4 0 0 1 4 -4h4M16 19h6M19 16v6'
		}
	],
	[
		'aus-den-hubs',
		{
			label: 'Aus den Hubs',
			description: 'Beiträge deiner Hubs',
			href: '/aus-den-hubs',
			icon: 'M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-13a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11'
		}
	],
	[
		'schwarzes-brett',
		{
			label: 'Schwarzes Brett',
			description: 'Anzeigen von Kolleginnen und Kollegen',
			href: '/schwarzes-brett',
			icon: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1zM8 8h4M8 12h8M8 16h6'
		}
	],
	[
		'kalender',
		{
			label: 'Kalender',
			description: 'Termine aus allen Bereichen',
			href: '/kalender',
			icon: 'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2zM16 3v4M8 3v4M4 11h16M8 15h2v2h-2z'
		}
	],
	[
		'rechtliches',
		{
			label: 'Rechtliches',
			description: 'Vereinbarungen, Gesetze, Tarifverträge',
			href: '/rechtliches',
			icon: 'M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0zM8 21h8'
		}
	],
	[
		'faqs',
		{
			label: 'FAQs',
			description: 'Häufige Fragen aller Bereiche',
			href: '/faqs',
			icon: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18M12 16v.01M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483'
		}
	],
	[
		'speiseplan',
		{
			label: 'Speiseplan',
			description: 'Kantine an deinem Standort',
			href: '/speiseplan',
			icon: 'M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12zM19 15v6h-1v-3M8 4v17M5 4v3a3 3 0 1 0 6 0v-3'
		}
	],
	[
		'plaene',
		{
			label: 'Pläne (KBB)',
			description: 'Wochen- und Monatspläne',
			href: '/plaene',
			icon: 'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2zM16 3v4M8 3v4M4 11h16'
		}
	],
	[
		'organigramm',
		{
			label: 'Organigramm',
			description: 'Aufbau aller Häuser',
			href: '/organigramm',
			icon: 'M3 21h18M5 21v-14l8 -4v18M19 21v-10l-6 -4'
		}
	],
	[
		'neuigkeiten',
		{
			label: 'Neuigkeiten',
			description: 'Aktuelles aus allen Bereichen',
			href: '/neuigkeiten',
			icon: 'M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-13a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11M8 8h4M8 12h4M8 16h4'
		}
	]
]);

export function isFavoriteTarget(key: string): boolean {
	return TARGETS.has(key) || UNIT_KEY.test(key);
}

/** Abteilungsseiten als Favoriten: nur sichtbare, nicht archivierte Einheiten. */
async function unitTargets(personId: string, keys: string[]) {
	const ids = keys.flatMap((k) => UNIT_KEY.exec(k)?.[1] ?? []);
	if (ids.length === 0) return new Map<string, FavoriteTarget>();
	const rows = await db
		.select({
			id: units.id,
			slug: units.slug,
			name: units.name,
			type: units.type,
			title: units.title
		})
		.from(units)
		.where(
			and(
				inArray(units.id, ids),
				isNull(units.archivedAt),
				or(
					eq(units.isCentral, true),
					sql`${units.tenantId} = (select tenant_id from persons where id = ${personId})`
				)
			)
		);
	return new Map(
		rows.map((u) => [
			unitFavoriteKey(u.id),
			{
				label: u.name,
				description: unitTypeLabel(u),
				// Hubs haben eine eigene Seite
				href: u.type === 'hub' ? `/hubs/${u.slug}` : `/abteilungen/${u.slug}`,
				icon: u.type === 'hub' ? HUB_ICON : UNIT_ICON
			}
		])
	);
}

export async function listFavorites(personId: string) {
	const rows = await db
		.select({ key: favorites.key })
		.from(favorites)
		.where(eq(favorites.personId, personId))
		.orderBy(asc(favorites.position));
	const dyn = await unitTargets(
		personId,
		rows.map((r) => r.key)
	);
	return rows.flatMap((r) => {
		const t = TARGETS.get(r.key) ?? dyn.get(r.key);
		return t ? [{ key: r.key, ...t }] : [];
	});
}

export type FavoriteResult = 'added' | 'removed' | 'full' | 'unknown';

export async function toggleFavorite(personId: string, key: string): Promise<FavoriteResult> {
	if (!isFavoriteTarget(key)) return 'unknown';
	return db.transaction(async (tx) => {
		const rows = await tx
			.select({ key: favorites.key, position: favorites.position })
			.from(favorites)
			.where(eq(favorites.personId, personId))
			.orderBy(asc(favorites.position));
		if (rows.some((r) => r.key === key)) {
			await saveOrder(
				tx,
				personId,
				rows.map((r) => r.key).filter((k) => k !== key)
			);
			return 'removed' as const;
		}
		if (rows.length >= FAVORITES_MAX) return 'full' as const;
		await tx.insert(favorites).values({ personId, key, position: rows.length });
		return 'added' as const;
	});
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function saveOrder(tx: Tx, personId: string, keys: string[]) {
	await tx.delete(favorites).where(eq(favorites.personId, personId));
	if (keys.length > 0) {
		await tx.insert(favorites).values(keys.map((key, position) => ({ personId, key, position })));
	}
}

/** Neue Reihenfolge; nur vorhandene Favoriten, Unbekanntes fällt weg. */
export async function reorderFavorites(personId: string, keys: string[]) {
	await db.transaction(async (tx) => {
		const current = new Set(
			(
				await tx
					.select({ key: favorites.key })
					.from(favorites)
					.where(eq(favorites.personId, personId))
			).map((r) => r.key)
		);
		const next = keys.filter((k, i) => current.has(k) && keys.indexOf(k) === i);
		for (const k of current) if (!next.includes(k)) next.push(k);
		await saveOrder(tx, personId, next.slice(0, FAVORITES_MAX));
	});
}

export async function removeFavorite(personId: string, key: string) {
	const rest = (await listFavorites(personId)).map((f) => f.key).filter((k) => k !== key);
	await db.transaction((tx) => saveOrder(tx, personId, rest));
}

// ---------------------------------------------------------------------------
// Standard-Favoriten je Mandant (Kap. 7: Rechtliches, IT, FAQs, Pläne)
// ---------------------------------------------------------------------------

/** Wählbare Favoriten für einen Mandanten: feste Ziele und sichtbare Abteilungsseiten. */
export async function favoriteChoices(tenantId: string) {
	const einheiten = await db
		.select({ id: units.id, name: units.name, type: units.type, title: units.title })
		.from(units)
		.where(
			and(
				sql`${units.type} <> 'hub'`,
				isNull(units.archivedAt),
				eq(units.hidden, false),
				or(eq(units.isCentral, true), eq(units.tenantId, tenantId))
			)
		)
		.orderBy(asc(units.name));
	return [
		...[...TARGETS.entries()].map(([key, t]) => ({
			key,
			label: t.label,
			description: t.description
		})),
		...einheiten.map((u) => ({
			key: unitFavoriteKey(u.id),
			label: u.name,
			description: unitTypeLabel(u)
		}))
	];
}

/** Standard ohne Einstellung: Rechtliches, IT (falls vorhanden), FAQs, Pläne. */
export async function defaultFavoritesFor(tenantId: string): Promise<string[]> {
	const [t] = await db
		.select({ favs: tenants.defaultFavorites })
		.from(tenants)
		.where(eq(tenants.id, tenantId));
	const choices = new Set((await favoriteChoices(tenantId)).map((c) => c.key));
	if (t?.favs) return t.favs.filter((k) => choices.has(k)).slice(0, FAVORITES_MAX);
	const [it] = await db
		.select({ id: units.id })
		.from(units)
		.where(
			and(
				eq(units.slug, 'it'),
				isNull(units.archivedAt),
				or(eq(units.isCentral, true), eq(units.tenantId, tenantId))
			)
		);
	return ['rechtliches', it ? unitFavoriteKey(it.id) : null, 'faqs', 'plaene'].filter(
		(k): k is string => !!k && choices.has(k)
	);
}

/** Neue Person: Standard-Favoriten ihres Mandanten übernehmen (nur wenn noch keine da sind). */
export async function seedFavorites(personId: string, tenantId: string) {
	const keys = await defaultFavoritesFor(tenantId);
	if (keys.length === 0) return;
	const [has] = await db
		.select({ key: favorites.key })
		.from(favorites)
		.where(eq(favorites.personId, personId))
		.limit(1);
	if (has) return;
	await db
		.insert(favorites)
		.values(keys.map((key, position) => ({ personId, key, position })))
		.onConflictDoNothing();
}

// ---------------------------------------------------------------------------
// Führung und Einführungen (Kap. 13)
// ---------------------------------------------------------------------------

export async function getHelpSeen(personId: string): Promise<string[]> {
	const [row] = await db
		.select({ seen: personPreferences.helpSeen })
		.from(personPreferences)
		.where(eq(personPreferences.personId, personId));
	return row?.seen ?? [];
}

export async function markHelpSeen(personId: string, key: string) {
	const seen = await getHelpSeen(personId);
	if (seen.includes(key)) return;
	const next = [...seen, key].slice(-50);
	await db
		.insert(personPreferences)
		.values({ personId, helpSeen: next })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { helpSeen: next } });
}

/** „Einführungen wieder anbieten“: alles außer der Führung zurücksetzen. */
export async function resetHelpSeen(personId: string) {
	const keep = (await getHelpSeen(personId)).filter((k) => k === 'fuehrung');
	await db
		.insert(personPreferences)
		.values({ personId, helpSeen: keep })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { helpSeen: keep } });
}

/** Zeitpunkt, an dem die Person zuletzt die Neuigkeiten geöffnet hat. */
export async function getNewsSeen(personId: string): Promise<Date | null> {
	const [row] = await db
		.select({ seen: personPreferences.newsSeenAt })
		.from(personPreferences)
		.where(eq(personPreferences.personId, personId));
	return row?.seen ?? null;
}

export async function markNewsSeen(personId: string, at = new Date()) {
	await db
		.insert(personPreferences)
		.values({ personId, newsSeenAt: at })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { newsSeenAt: at } });
}

// ---------------------------------------------------------------------------
// Hinweis „Neu in Version …“ nach einem Update
// ---------------------------------------------------------------------------

export async function getVersionHint(
	personId: string
): Promise<{ an: boolean; gesehen: string | null }> {
	const [row] = await db
		.select({ an: personPreferences.versionHint, gesehen: personPreferences.versionSeen })
		.from(personPreferences)
		.where(eq(personPreferences.personId, personId));
	return row ?? { an: true, gesehen: null };
}

export async function setVersionHint(personId: string, an: boolean) {
	await db
		.insert(personPreferences)
		.values({ personId, versionHint: an })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { versionHint: an } });
}

export async function markVersionSeen(personId: string, version: string) {
	await db
		.insert(personPreferences)
		.values({ personId, versionSeen: version })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { versionSeen: version } });
}
