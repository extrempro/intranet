import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index';

/**
 * Spielt ausstehende Migrationen aus ./drizzle ein. Läuft beim Start der
 * Anwendung (hooks.server.ts → init), damit Arcane nach einem Git-Sync
 * nichts weiter ausführen muss. Drizzle sperrt dabei per Transaktion.
 */
export async function runMigrations(folder = process.env.MIGRATIONS_DIR ?? 'drizzle') {
	await migrate(db, { migrationsFolder: folder });
}
