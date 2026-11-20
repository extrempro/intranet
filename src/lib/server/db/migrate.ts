import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { APP_ROLE, db } from './index.ts';

/**
 * Spielt ausstehende Migrationen aus ./drizzle ein und setzt danach das
 * Passwort der App-Rolle aus APP_DATABASE_PASSWORD. Läuft beim Start der
 * Anwendung (hooks.server.ts → init), damit Docker-Verwaltung nach einem Git-Sync
 * nichts weiter ausführen muss.
 */
export async function runMigrations(folder = process.env.MIGRATIONS_DIR ?? 'drizzle') {
	await migrate(db, { migrationsFolder: folder });

	const password = process.env.APP_DATABASE_PASSWORD;
	if (password) {
		// ALTER ROLE erlaubt keine Parameter; Literal sicher maskieren
		const literal = `'${password.replace(/'/g, "''")}'`;
		await db.execute(sql.raw(`ALTER ROLE ${APP_ROLE} LOGIN PASSWORD ${literal}`));
	}
}
