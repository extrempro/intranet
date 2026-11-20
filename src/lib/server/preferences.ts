import { asc, eq } from 'drizzle-orm';
import { FAVORITES_MAX, type HomeLayout } from '../home.ts';
import { db } from './db/index.ts';
import { favorites, personPreferences } from './db/schema.ts';

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
const TARGETS = new Map<string, FavoriteTarget>([
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
	return TARGETS.has(key);
}

export async function listFavorites(personId: string) {
	const rows = await db
		.select({ key: favorites.key })
		.from(favorites)
		.where(eq(favorites.personId, personId))
		.orderBy(asc(favorites.position));
	return rows.flatMap((r) => {
		const t = TARGETS.get(r.key);
		return t ? [{ key: r.key, ...t }] : [];
	});
}

export type FavoriteResult = 'added' | 'removed' | 'full' | 'unknown';

export async function toggleFavorite(personId: string, key: string): Promise<FavoriteResult> {
	if (!TARGETS.has(key)) return 'unknown';
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
