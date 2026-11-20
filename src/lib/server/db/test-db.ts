/**
 * Hilfen für Tests mit echter Datenbank (*.db.test.ts). Vitest führt Dateien
 * parallel aus: Jede Testdatei nutzt deshalb eine eigene Datenbank im selben
 * Cluster, und das Anlegen der gemeinsamen Rolle intranet_app wird bei einem
 * Wettlauf wiederholt.
 */
import postgres from 'postgres';

/** Legt <db>_<suffix> neu an und gibt die Adresse zurück. */
export async function freshDatabase(baseUrl: string, suffix: string): Promise<string> {
	const url = new URL(baseUrl);
	const name = `${url.pathname.slice(1)}_${suffix}`.replace(/[^a-z0-9_]/gi, '_');
	const admin = postgres(baseUrl, { max: 1, onnotice: () => {} });
	try {
		await admin.unsafe(`drop database if exists "${name}" with (force)`);
		await admin.unsafe(`create database "${name}"`);
	} finally {
		await admin.end();
	}
	url.pathname = `/${name}`;
	return url.toString();
}

export async function migrateWithRetry(run: () => Promise<void>, tries = 5): Promise<void> {
	for (let i = 1; ; i++) {
		try {
			return await run();
		} catch (err) {
			if (i >= tries) throw err;
			await new Promise((r) => setTimeout(r, 300 * i));
		}
	}
}
