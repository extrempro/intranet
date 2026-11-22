/**
 * Speicherorte der Dateien (Kap. 18): „Lokal“ (Volume FILES_DIR) oder ein
 * S3-kompatibler Objektspeicher. Abgelegt wird immer der vom Intranet
 * verschlüsselte Inhalt; der Speicherort sieht nie Klartext.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
	DeleteObjectCommand,
	GetBucketVersioningCommand,
	GetObjectCommand,
	HeadBucketCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { eq } from 'drizzle-orm';
import { Agent as HttpAgent } from 'node:http';
import { db } from '../db/index.ts';
import { storageTargets } from '../db/schema.ts';
import { decryptSecret } from '../crypto.ts';
import { getSetting, setSetting } from '../settings.ts';
import { sichererAgent } from '../sicheres-netz.ts';
import { istKategorie, KATEGORIEN, type Kategorie, type Zuordnung } from '../../speicher.ts';

export class SpeicherFehler extends Error {}

/** Nur für Tests und CI: S3 über http auf localhost erlauben. */
export function s3TestModus(): boolean {
	return process.env.S3_TEST_UNSICHER === '1' && process.env.NODE_ENV !== 'production';
}

// ---------------------------------------------------------------------------
// Lokal
// ---------------------------------------------------------------------------

function root(): string {
	return resolve(process.env.FILES_DIR ?? 'data/files');
}

function lokalerPfad(id: string): string {
	if (!/^[0-9a-f-]{36}$/.test(id)) throw new SpeicherFehler('Ungültige Datei');
	return join(root(), id.slice(0, 2), id);
}

// ---------------------------------------------------------------------------
// S3
// ---------------------------------------------------------------------------

type Ziel = typeof storageTargets.$inferSelect;

const clients = new Map<string, { stand: number; client: S3Client; bucket: string }>();

export function s3Client(
	t: Pick<Ziel, 'endpoint' | 'region' | 'accessKey' | 'pathStyle'>,
	secret: string
) {
	const test = s3TestModus();
	return new S3Client({
		endpoint: t.endpoint,
		region: t.region || 'us-east-1',
		forcePathStyle: t.pathStyle,
		credentials: { accessKeyId: t.accessKey, secretAccessKey: secret },
		maxAttempts: 3,
		requestHandler: new NodeHttpHandler({
			httpsAgent: sichererAgent(),
			// http nur im Testmodus (lokaler Testspeicher)
			httpAgent: test ? new HttpAgent({ keepAlive: true }) : undefined,
			connectionTimeout: 5_000,
			requestTimeout: 120_000
		}),
		// Prüfsummen nur, wenn der Speicher sie verlangt (kompatibel mit mehr Anbietern)
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED'
	});
}

async function clientFuer(targetId: string) {
	const [t] = await db.select().from(storageTargets).where(eq(storageTargets.id, targetId));
	if (!t) throw new SpeicherFehler('Speicherort nicht gefunden');
	const stand = t.updatedAt.getTime();
	const vorhanden = clients.get(targetId);
	if (vorhanden && vorhanden.stand === stand) return vorhanden;
	vorhanden?.client.destroy();
	const neu = {
		stand,
		client: s3Client(t, new TextDecoder().decode(decryptSecret(t.secretEnc))),
		bucket: t.bucket
	};
	clients.set(targetId, neu);
	return neu;
}

/** Nach dem Ändern oder Löschen eines Speicherorts */
export function clientVergessen(targetId: string) {
	clients.get(targetId)?.client.destroy();
	clients.delete(targetId);
}

const s3Key = (id: string) => {
	if (!/^[0-9a-f-]{36}$/.test(id)) throw new SpeicherFehler('Ungültige Datei');
	return `files/${id}`;
};

// ---------------------------------------------------------------------------
// Gemeinsam
// ---------------------------------------------------------------------------

/** Verschlüsselten Inhalt einer Datei ablegen (überschreibt nicht, wenn lokal). */
export async function objektSchreiben(targetId: string | null, id: string, data: Uint8Array) {
	if (!targetId) {
		await mkdir(join(root(), id.slice(0, 2)), { recursive: true, mode: 0o700 });
		await writeFile(lokalerPfad(id), data, { mode: 0o600, flag: 'wx' });
		return;
	}
	const { client, bucket } = await clientFuer(targetId);
	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: s3Key(id),
			Body: data,
			ContentType: 'application/octet-stream'
		})
	);
}

export async function objektLesen(targetId: string | null, id: string): Promise<Buffer> {
	if (!targetId) return readFile(lokalerPfad(id));
	const { client, bucket } = await clientFuer(targetId);
	const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key(id) }));
	if (!res.Body) throw new SpeicherFehler('Leere Antwort des Speichers');
	return Buffer.from(await res.Body.transformToByteArray());
}

export async function objektLoeschen(targetId: string | null, id: string) {
	if (!targetId) {
		await rm(lokalerPfad(id), { force: true });
		return;
	}
	const { client, bucket } = await clientFuer(targetId);
	await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key(id) }));
}

export interface PruefErgebnis {
	ok: boolean;
	versionierung: boolean | null;
	meldung: string;
	schritte: { label: string; ok: boolean | null }[];
}

/** Schreiben, Lesen, Löschen eines Testobjekts und Versionierung des Buckets prüfen. */
export async function verbindungPruefen(client: S3Client, bucket: string): Promise<PruefErgebnis> {
	const schritte: PruefErgebnis['schritte'] = [
		{ label: 'Bucket erreichbar', ok: null },
		{ label: 'Schreiben', ok: null },
		{ label: 'Lesen', ok: null },
		{ label: 'Löschen', ok: null },
		{ label: 'Versionierung eingeschaltet', ok: null }
	];
	const key = `intranet-verbindungstest/${crypto.randomUUID()}`;
	const inhalt = crypto.getRandomValues(new Uint8Array(32));
	let schritt = 0;
	try {
		await client.send(new HeadBucketCommand({ Bucket: bucket }));
		schritte[schritt++].ok = true;
		await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: inhalt }));
		schritte[schritt++].ok = true;
		const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
		const zurueck = await res.Body?.transformToByteArray();
		if (!zurueck || Buffer.compare(Buffer.from(zurueck), Buffer.from(inhalt)) !== 0)
			throw new SpeicherFehler('Gelesener Inhalt weicht ab');
		schritte[schritt++].ok = true;
		await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
		schritte[schritt++].ok = true;
	} catch (err) {
		schritte[schritt].ok = false;
		return { ok: false, versionierung: null, meldung: s3Fehlertext(err), schritte };
	}
	let versionierung: boolean | null;
	try {
		const v = await client.send(new GetBucketVersioningCommand({ Bucket: bucket }));
		versionierung = v.Status === 'Enabled';
	} catch {
		versionierung = null;
	}
	schritte[4].ok = versionierung;
	return {
		ok: true,
		versionierung,
		meldung: versionierung
			? 'Verbindung in Ordnung.'
			: 'Verbindung in Ordnung. Schalte im Bucket die Versionierung ein, damit gelöschte oder überschriebene Dateien wiederherstellbar sind.',
		schritte
	};
}

/** Verständliche Meldung ohne Interna (keine Schlüssel, keine Stacktraces). */
export function s3Fehlertext(err: unknown): string {
	const e = err as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
	const status = e?.$metadata?.httpStatusCode;
	if (e?.code === 'EINTERN')
		return 'Die Adresse zeigt auf ein internes Netz. Das ist nicht erlaubt.';
	if (e?.code === 'ENOTFOUND') return 'Die Adresse wurde nicht gefunden.';
	if (e?.code === 'ECONNREFUSED' || e?.code === 'ETIMEDOUT' || e?.name === 'TimeoutError')
		return 'Der Speicher antwortet nicht.';
	if (e?.name === 'NoSuchBucket' || status === 404) return 'Den Bucket gibt es nicht.';
	if (
		e?.name === 'InvalidAccessKeyId' ||
		e?.name === 'SignatureDoesNotMatch' ||
		status === 403 ||
		status === 401
	)
		return 'Zugriff verweigert. Prüfe Access Key, Secret Key und die Rechte auf den Bucket.';
	if (err instanceof SpeicherFehler) return err.message;
	return 'Der Speicher hat einen Fehler gemeldet.';
}

// ---------------------------------------------------------------------------
// Zuordnung Inhaltsart → Speicherort
// ---------------------------------------------------------------------------

const ZUORDNUNG = 'speicher.zuordnung';

export async function zuordnung(): Promise<Record<Kategorie, string | null>> {
	const gespeichert = await getSetting<Zuordnung>(ZUORDNUNG, {});
	const ziele = new Set(
		(await db.select({ id: storageTargets.id }).from(storageTargets)).map((t) => t.id)
	);
	const ergebnis = {} as Record<Kategorie, string | null>;
	for (const k of KATEGORIEN) {
		const t = gespeichert[k.key];
		ergebnis[k.key] = t && ziele.has(t) ? t : null;
	}
	return ergebnis;
}

export async function zuordnungSetzen(k: Kategorie, targetId: string | null, personId: string) {
	if (!istKategorie(k)) throw new SpeicherFehler('Unbekannte Inhaltsart');
	const aktuell = await getSetting<Zuordnung>(ZUORDNUNG, {});
	await setSetting(ZUORDNUNG, { ...aktuell, [k]: targetId }, personId);
}

/** Speicherort für neue Dateien einer Inhaltsart */
export async function zielFuer(k: Kategorie): Promise<string | null> {
	return (await zuordnung())[k];
}
