/**
 * Verwaltung → System (Kap. 14, 18): Version, Zustand und Sicherungen.
 * Die Sicherungen macht der Container „backup“; die Anwendung liest nur
 * dessen Statusdateien (Volume read-only unter BACKUP_DIR).
 */
import { readFile, statfs } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { and, eq, gt, sql } from 'drizzle-orm';
import {
	bewerteSicherung,
	leseListe,
	leseSicherung,
	leseTest,
	type Befund
} from '../system-status.ts';
import { getEntraConfig } from './auth/entra.ts';
import { db } from './db/index.ts';
import { files, notifications, roleAssignments } from './db/schema.ts';
import { jobState } from './jobs.ts';
import { mailConfigured } from './mail.ts';
import { notify } from './notify.ts';
import { pushStatus } from './push.ts';

export function backupDir(): string | null {
	const dir = process.env.BACKUP_DIR?.trim();
	return dir ? resolve(dir) : null;
}

async function readJson(path: string): Promise<unknown> {
	try {
		return JSON.parse(await readFile(path, 'utf8'));
	} catch {
		return null;
	}
}

export async function backupStatus() {
	const dir = backupDir();
	if (!dir) return null;
	const status = join(dir, 'status');
	const sicherung = leseSicherung(await readJson(join(status, 'letzte-sicherung.json')));
	const test = leseTest(await readJson(join(status, 'letzter-test.json')));
	const liste = leseListe(await readJson(join(status, 'sicherungen.json')));
	return {
		sicherung,
		test,
		liste,
		befunde: bewerteSicherung(sicherung, test),
		speicher: await freeSpace(dir)
	};
}

async function freeSpace(path: string) {
	try {
		const s = await statfs(path);
		return { frei: s.bavail * s.bsize, gesamt: s.blocks * s.bsize };
	} catch {
		return null;
	}
}

async function appVersion(): Promise<string> {
	const pkg = (await readJson(resolve('package.json'))) as { version?: unknown } | null;
	return typeof pkg?.version === 'string' ? pkg.version : 'unbekannt';
}

async function migrations() {
	const folder = process.env.MIGRATIONS_DIR ?? 'drizzle';
	const journal = (await readJson(resolve(folder, 'meta', '_journal.json'))) as {
		entries?: unknown[];
	} | null;
	const vorhanden = Array.isArray(journal?.entries) ? journal.entries.length : null;
	let eingespielt: number | null;
	try {
		const rows = await db.execute<{ n: number }>(
			sql`select count(*)::int as n from drizzle.__drizzle_migrations`
		);
		eingespielt = Number(rows[0]?.n ?? 0);
	} catch {
		eingespielt = null;
	}
	return { vorhanden, eingespielt };
}

export async function systemStatus(buildVersion: string) {
	const [dbInfo] = await db.execute<{ version: string; groesse: number }>(
		sql`select current_setting('server_version') as version, pg_database_size(current_database())::bigint as groesse`
	);
	const [dateien] = await db
		.select({
			n: sql<number>`count(*)::int`,
			bytes: sql<number>`coalesce(sum(${files.size}), 0)::bigint`
		})
		.from(files);
	const push = await pushStatus();
	return {
		version: await appVersion(),
		build: buildVersion,
		node: process.version,
		laufzeitS: Math.floor(process.uptime()),
		datenbank: {
			version: dbInfo.version,
			groesse: Number(dbInfo.groesse),
			migrationen: await migrations()
		},
		dateien: {
			anzahl: dateien.n,
			bytes: Number(dateien.bytes),
			speicher: await freeSpace(resolve(process.env.FILES_DIR ?? 'data/files'))
		},
		aufgaben: {
			aufraeumen: jobState('aufraeumen'),
			benachrichtigungen: jobState('benachrichtigungen')
		},
		anbindungen: {
			entra: Boolean(await getEntraConfig()),
			mail: await mailConfigured(),
			push: push.keys,
			pushGeraete: push.devices,
			sicherung: Boolean(backupDir())
		}
	};
}

async function systemAdmins(): Promise<string[]> {
	const rows = await db
		.selectDistinct({ id: roleAssignments.personId })
		.from(roleAssignments)
		.where(eq(roleAssignments.role, 'system_admin'));
	return rows.map((r) => r.id);
}

/**
 * Meldung an alle System-Admins (Thema „Betrieb und Sicherungen“), dieselbe
 * Meldung höchstens einmal in 23 Stunden.
 */
export async function notifySystemAdmins(text: string): Promise<boolean> {
	const title = text.slice(0, 200);
	const [schon] = await db
		.select({ id: notifications.id })
		.from(notifications)
		.where(
			and(
				eq(notifications.topic, 'system'),
				eq(notifications.title, title),
				gt(notifications.createdAt, sql`now() - interval '23 hours'`)
			)
		)
		.limit(1);
	if (schon) return false;
	await notify('system', await systemAdmins(), {
		title,
		detail: 'System',
		link: '/verwaltung/system'
	});
	return true;
}

/** Stündlich (Aufräumen): Fehler bei der Sicherung an die System-Admins melden. Warnungen nur auf der Seite. */
export async function checkBackups(): Promise<Befund[]> {
	const status = await backupStatus();
	if (!status) return [];
	const fehler = status.befunde.filter((b) => b.stufe === 'fehler');
	for (const b of fehler) await notifySystemAdmins(`Sicherung: ${b.text}`);
	return fehler;
}
