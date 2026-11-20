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
const TARGETS = new Map<string, FavoriteTarget>();

export function registerFavoriteTarget(key: string, target: FavoriteTarget) {
	TARGETS.set(key, target);
}

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
