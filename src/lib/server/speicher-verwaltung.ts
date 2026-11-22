/**
 * Verwaltung → Speicher (Kap. 18): S3-Speicher anlegen, prüfen, löschen;
 * Übersicht der Belegung je Inhaltsart und Speicherort.
 */
import { statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from './db/index.ts';
import { files, storageMoves, storageTargets } from './db/schema.ts';
import { decryptSecret, encryptSecret } from './crypto.ts';
import {
	clientVergessen,
	s3Client,
	s3TestModus,
	SpeicherFehler,
	verbindungPruefen,
	zuordnung,
	type PruefErgebnis
} from './files/speicherorte.ts';
import { bucketFehler, endpointFehler, KATEGORIEN } from '../speicher.ts';

export interface S3Eingabe {
	name: string;
	endpoint: string;
	region: string;
	bucket: string;
	accessKey: string;
	/** leer = beim Bearbeiten unverändert */
	secret: string;
	pathStyle: boolean;
}

export function s3EingabeLesen(fd: FormData): {
	werte: S3Eingabe;
	felder: Partial<Record<keyof S3Eingabe, string>>;
} {
	const t = (k: string, max = 300) =>
		String(fd.get(k) ?? '')
			.trim()
			.slice(0, max);
	const werte: S3Eingabe = {
		name: t('name', 80),
		endpoint: t('endpoint').replace(/\/+$/, ''),
		region: t('region', 60),
		bucket: t('bucket', 63),
		accessKey: t('accessKey', 200),
		secret: String(fd.get('secret') ?? '').slice(0, 500),
		pathStyle: fd.get('pathStyle') === 'on'
	};
	const felder: Partial<Record<keyof S3Eingabe, string>> = {};
	if (!werte.name) felder.name = 'Gib einen Namen ein.';
	const ep =
		s3TestModus() && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(werte.endpoint)
			? null
			: endpointFehler(werte.endpoint);
	if (ep) felder.endpoint = ep;
	if (!/^[a-z0-9-]{0,60}$/.test(werte.region))
		felder.region = 'Region: nur Kleinbuchstaben, Ziffern und Bindestrich.';
	const b = bucketFehler(werte.bucket);
	if (b) felder.bucket = b;
	if (!werte.accessKey) felder.accessKey = 'Gib den Access Key ein.';
	return { werte, felder };
}

async function secretVon(id: string): Promise<string> {
	const [t] = await db
		.select({ s: storageTargets.secretEnc })
		.from(storageTargets)
		.where(eq(storageTargets.id, id));
	if (!t) throw new SpeicherFehler('Speicherort nicht gefunden');
	return new TextDecoder().decode(decryptSecret(t.s));
}

/** Verbindung mit den eingegebenen Werten prüfen (vor dem Speichern). */
export async function eingabePruefen(w: S3Eingabe, id: string | null): Promise<PruefErgebnis> {
	const secret = w.secret || (id ? await secretVon(id) : '');
	if (!secret)
		return { ok: false, versionierung: null, meldung: 'Gib den Secret Key ein.', schritte: [] };
	const client = s3Client(w, secret);
	try {
		return await verbindungPruefen(client, w.bucket);
	} finally {
		client.destroy();
	}
}

export async function s3Speichern(w: S3Eingabe, id: string | null, pruefung: PruefErgebnis) {
	const geprueft = {
		checkedAt: new Date(),
		checkOk: pruefung.ok,
		checkVersioning: pruefung.versionierung,
		checkMessage: pruefung.meldung
	};
	const basis = {
		name: w.name,
		endpoint: w.endpoint,
		region: w.region,
		bucket: w.bucket,
		accessKey: w.accessKey,
		pathStyle: w.pathStyle,
		...geprueft
	};
	if (id) {
		await db
			.update(storageTargets)
			.set({
				...basis,
				...(w.secret ? { secretEnc: encryptSecret(new TextEncoder().encode(w.secret)) } : {}),
				updatedAt: new Date()
			})
			.where(eq(storageTargets.id, id));
		clientVergessen(id);
		return id;
	}
	if (!w.secret) throw new SpeicherFehler('Gib den Secret Key ein.');
	const [neu] = await db
		.insert(storageTargets)
		.values({ ...basis, secretEnc: encryptSecret(new TextEncoder().encode(w.secret)) })
		.returning({ id: storageTargets.id });
	return neu.id;
}

/** Gespeicherten Speicher erneut prüfen und das Ergebnis merken. */
export async function gespeichertPruefen(id: string): Promise<PruefErgebnis> {
	const [t] = await db.select().from(storageTargets).where(eq(storageTargets.id, id));
	if (!t) throw new SpeicherFehler('Speicherort nicht gefunden');
	const client = s3Client(t, await secretVon(id));
	try {
		const r = await verbindungPruefen(client, t.bucket);
		await db
			.update(storageTargets)
			.set({
				checkedAt: new Date(),
				checkOk: r.ok,
				checkVersioning: r.versionierung,
				checkMessage: r.meldung
			})
			.where(eq(storageTargets.id, id));
		return r;
	} finally {
		client.destroy();
	}
}

/** Löschen nur, wenn keine Dateien mehr dort liegen und nichts mehr dorthin zeigt. */
export async function s3Loeschen(id: string) {
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(files)
		.where(eq(files.storageTargetId, id));
	if (n > 0)
		throw new SpeicherFehler(
			`Dort liegen noch ${n} Dateien. Zieh sie zuerst an einen anderen Ort um.`
		);
	const z = await zuordnung();
	if (Object.values(z).includes(id))
		throw new SpeicherFehler('Der Speicher ist noch einer Inhaltsart zugeordnet.');
	await db.delete(storageTargets).where(eq(storageTargets.id, id));
	clientVergessen(id);
}

export async function speicherUebersicht() {
	const ziele = await db
		.select({
			id: storageTargets.id,
			name: storageTargets.name,
			endpoint: storageTargets.endpoint,
			region: storageTargets.region,
			bucket: storageTargets.bucket,
			accessKey: storageTargets.accessKey,
			pathStyle: storageTargets.pathStyle,
			checkedAt: storageTargets.checkedAt,
			checkOk: storageTargets.checkOk,
			checkVersioning: storageTargets.checkVersioning,
			checkMessage: storageTargets.checkMessage
		})
		.from(storageTargets)
		.orderBy(storageTargets.name);
	const belegung = await db
		.select({
			category: files.category,
			ziel: files.storageTargetId,
			anzahl: sql<number>`count(*)::int`,
			bytes: sql<number>`coalesce(sum(${files.size}), 0)::float8`
		})
		.from(files)
		.groupBy(files.category, files.storageTargetId);
	const umzuege = await db
		.select()
		.from(storageMoves)
		.orderBy(desc(storageMoves.startedAt))
		.limit(20);
	let platte: { frei: number; gesamt: number } | null;
	try {
		const s = await statfs(resolve(process.env.FILES_DIR ?? 'data/files'));
		platte = { frei: s.bavail * s.bsize, gesamt: s.blocks * s.bsize };
	} catch {
		platte = null;
	}
	const z = await zuordnung();
	return {
		ziele,
		platte,
		kategorien: KATEGORIEN.map((k) => {
			const zeilen = belegung.filter((b) => b.category === k.key);
			const laufend = umzuege.find((u) => u.category === k.key && u.status === 'laufend') ?? null;
			const letzter = umzuege.find((u) => u.category === k.key) ?? null;
			return {
				key: k.key,
				label: k.label,
				text: k.text,
				ziel: z[k.key],
				anzahl: zeilen.reduce((a, b) => a + b.anzahl, 0),
				bytes: zeilen.reduce((a, b) => a + b.bytes, 0),
				orte: zeilen.map((b) => ({ ziel: b.ziel, anzahl: b.anzahl, bytes: b.bytes })),
				umzug: laufend
					? {
							id: laufend.id,
							total: laufend.total,
							done: laufend.done,
							failed: laufend.failed,
							ziel: laufend.targetId
						}
					: null,
				letzterUmzug:
					letzter && letzter.status !== 'laufend'
						? { status: letzter.status, message: letzter.message, finishedAt: letzter.finishedAt }
						: null
			};
		}),
		belegungJeZiel: Object.fromEntries(
			[null, ...ziele.map((t) => t.id)].map((id) => [
				id ?? 'lokal',
				belegung.filter((b) => b.ziel === id).reduce((a, b) => a + b.bytes, 0)
			])
		) as Record<string, number>
	};
}
