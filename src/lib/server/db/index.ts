import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function connect() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL ist nicht gesetzt');
	return drizzle(postgres(url, { max: 10 }), { schema });
}

type Db = ReturnType<typeof connect>;
let instance: Db | undefined;

/**
 * Verbindung wird erst beim ersten Zugriff aufgebaut, damit der Build
 * (der Server-Module zur Analyse lädt) keine Datenbank braucht.
 */
export const db = new Proxy({} as Db, {
	get(_target, prop) {
		instance ??= connect();
		const value = Reflect.get(instance, prop, instance);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});
