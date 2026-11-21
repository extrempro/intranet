#!/usr/bin/env node
/**
 * Notfallzugang: legt einen Link für einen weiteren lokalen System-Admin an
 * (z. B. wenn die Anmeldung mit Microsoft nicht geht oder nach einer
 * Wiederherstellung). Aufruf auf dem Server:
 *
 *   docker compose exec app node scripts/notfall-admin.mjs
 *
 * Der Link gilt 24 Stunden und nur einmal; ein neuer Aufruf macht den
 * vorigen ungültig. Steht im Protokoll (Verwaltung → Protokoll).
 */
import { createHash, randomBytes } from 'node:crypto';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
const origin = process.env.ORIGIN?.trim() || 'http://localhost:3000';
if (!url) {
	console.error('DATABASE_URL fehlt. Im Container der Anwendung ausführen.');
	process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
	const [{ n }] = await sql`select count(*)::int as n from tenants`;
	if (n === 0) {
		console.error(
			'Es gibt noch keinen Mandanten. Den Link für die Ersteinrichtung schreibt die Anwendung beim Start ins Log (docker compose logs app); ein Neustart erzeugt einen neuen.'
		);
		process.exit(1);
	}
	const token = randomBytes(32).toString('base64url');
	const wert = {
		hash: createHash('sha256').update(token).digest('hex'),
		bis: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
		art: 'notfall'
	};
	await sql`
		insert into settings (key, value, updated_at)
		values ('einrichtung.link', ${sql.json(wert)}, now())
		on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = null`;
	await sql`
		insert into audit_log (category, action, details)
		values ('security', 'setup.emergency_link', ${sql.json({ bis: wert.bis })})`;
	const link = new URL(`/einrichtung/${token}`, origin).href;
	console.log(
		`\nNotfallzugang: weiteren lokalen System-Admin anlegen\n\n  ${link}\n\nGilt 24 Stunden und nur einmal.\n`
	);
} finally {
	await sql.end();
}
