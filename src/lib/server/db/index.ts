/**
 * Zwei Verbindungen:
 *
 * - db: Besitzer der Datenbank (DATABASE_URL). Für Migrationen, Anmeldung,
 *   Sitzungen, Protokoll und Verwaltung über Mandantengrenzen hinweg. Umgeht
 *   Row-Level Security – Rechte werden dort im Code geprüft.
 * - scoped(): eingeschränkte Rolle intranet_app (APP_DATABASE_PASSWORD) für
 *   alle Inhalte, die Personen sehen. Setzt Mandant und Person in der
 *   Transaktion; die Policies in PostgreSQL trennen die Mandanten zusätzlich
 *   zum Code. Die Rolle hat keinen Zugriff auf Passwörter, Sitzungen o. Ä.
 *
 * Verbindungen entstehen erst beim ersten Zugriff, damit der Build ohne
 * Datenbank auskommt.
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const APP_ROLE = 'intranet_app';

function ownerUrl(): string {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL ist nicht gesetzt');
	return url;
}

/** Adresse für die App-Rolle: gleiche Datenbank, anderer Benutzer. */
export function appUrl(): string | null {
	const password = process.env.APP_DATABASE_PASSWORD;
	if (!password) return null;
	const url = new URL(ownerUrl());
	url.username = APP_ROLE;
	url.password = password;
	return url.href;
}

function connect(url: string) {
	return drizzle(postgres(url, { max: 10, onnotice: () => {} }), { schema });
}

type Db = ReturnType<typeof connect>;

const opened: Db[] = [];

/** Alle Verbindungen schließen (Tests, geordnetes Herunterfahren). */
export async function closeDb(): Promise<void> {
	await Promise.all(opened.splice(0).map((d) => d.$client.end()));
}

function lazy(create: () => Db): Db {
	let instance: Db | undefined;
	return new Proxy({} as Db, {
		get(_target, prop) {
			if (!instance) {
				instance = create();
				opened.push(instance);
			}
			const value = Reflect.get(instance, prop, instance);
			return typeof value === 'function' ? value.bind(instance) : value;
		}
	});
}

export const db = lazy(() => connect(ownerUrl()));

let warned = false;
const appDb = lazy(() => {
	const url = appUrl();
	if (url) return connect(url);
	if (process.env.NODE_ENV === 'production') {
		throw new Error('APP_DATABASE_PASSWORD ist nicht gesetzt');
	}
	if (!warned) {
		console.warn('APP_DATABASE_PASSWORD fehlt: Row-Level Security ist in der Entwicklung aus.');
		warned = true;
	}
	return connect(ownerUrl());
});

export type ScopedTx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Führt Abfragen im Namen einer Person aus. Innerhalb von fn sehen die
 * Policies app.tenant_id und app.person_id (nur für diese Transaktion).
 */
export function scoped<T>(
	who: { personId: string; tenantId: string },
	fn: (tx: ScopedTx) => Promise<T>
): Promise<T> {
	return appDb.transaction(async (tx) => {
		await tx.execute(
			sql`select set_config('app.tenant_id', ${who.tenantId}, true), set_config('app.person_id', ${who.personId}, true)`
		);
		return fn(tx);
	});
}
