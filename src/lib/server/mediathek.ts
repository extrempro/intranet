/**
 * Mediathek (Kap. 8.15): Videos je Einheit. Lesen über scoped() (Row-Level
 * Security: Einheit sichtbar, Mandanten-Einschränkung); Entwürfe und Videos in
 * Arbeit nur mit dem Recht „Mediathek“. Hochladen in Teilen in den lokalen
 * Arbeitsordner, Umwandlung im Dienst video, danach verschlüsselt an den
 * Speicherort der Inhaltsart „videos“.
 */
import { mkdir, open, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { canSeeUnit, canWriteMedia, mediaUnitIds, type Principal } from './auth/access.ts';
import { doc, headline, matches, rank } from './fts.ts';
import { db, scoped } from './db/index.ts';
import {
	files,
	roleAssignments,
	tenants,
	topics,
	units,
	videoAttachments,
	videos,
	videoTopics
} from './db/schema.ts';
import { deleteStored, MAX_ATTACHMENTS, ownUnlinkedFiles } from './files/store.ts';
import { cleanHtml, htmlToText } from './html.ts';
import { createHash } from 'node:crypto';
import { decryptFile, encryptFile, newFileKey, unwrapFileKey } from './files/crypto.ts';
import { medienLesen, medienLoeschen, medienSchreiben, zielFuer } from './files/speicherorte.ts';
import { getSetting, setSetting } from './settings.ts';
import { notify } from './notify.ts';
import { gueltigeThemen, themenSetzen } from './themen.ts';
import { unitTypeLabel } from '../roles.ts';
import {
	kapitelFehler,
	MAX_BESCHREIBUNG,
	MAX_KAPITEL,
	MAX_TITEL,
	MAX_VIDEO_BYTES,
	OHNE_UNTERTITEL,
	type OhneUntertitelGrund,
	TEIL_BYTES,
	type Kapitel
} from '../mediathek.ts';

export class MediathekFehler extends Error {
	constructor(
		message: string,
		/** HTTP-Status für Endpunkte: 400 Eingabe, 403 Recht, 404 nicht gefunden */
		readonly status: 400 | 403 | 404 = 400
	) {
		super(message);
	}
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function arbeitsOrdner(): string {
	return resolve(process.env.VIDEO_ARBEIT ?? 'data/arbeit');
}
const ordnerVon = (id: string) => {
	if (!GUID.test(id)) throw new MediathekFehler('Ungültiges Video');
	return join(arbeitsOrdner(), id);
};

// ---------------------------------------------------------------------------
// Obergrenze
// ---------------------------------------------------------------------------

const GRENZE = 'mediathek.grenzeGb';
export async function grenzeGb(): Promise<number> {
	return getSetting<number>(GRENZE, 500);
}
export async function grenzeSetzen(gb: number, personId: string) {
	if (!Number.isInteger(gb) || gb < 1 || gb > 100_000)
		throw new MediathekFehler('Gib eine Zahl zwischen 1 und 100000 ein.');
	await setSetting(GRENZE, gb, personId);
	await grenzePruefen();
}
/** Belegt: umgewandelte Videos plus angefangene Uploads (deren Größe) */
export async function belegtBytes(): Promise<number> {
	const [r] = await db
		.select({
			n: sql<number>`coalesce(sum(case when ${videos.status} in ('hochladen','warten','umwandeln') then ${videos.uploadSize} else ${videos.bytes} end), 0)::float8`
		})
		.from(videos);
	return r.n;
}

const GEWARNT = 'mediathek.gewarnt';
/** Ab 90 % der Grenze System-Admins einmal benachrichtigen; unter 80 % zurücksetzen */
export async function grenzePruefen() {
	const anteil = (await belegtBytes()) / ((await grenzeGb()) * 1024 ** 3);
	const gewarnt = await getSetting<boolean>(GEWARNT, false);
	if (anteil >= 0.9 && !gewarnt) {
		const admins = (
			await db
				.selectDistinct({ id: roleAssignments.personId })
				.from(roleAssignments)
				.where(eq(roleAssignments.role, 'system_admin'))
		).map((r) => r.id);
		await notify('system', admins, {
			title: `Die Mediathek ist zu ${Math.round(anteil * 100)} % belegt.`,
			detail: 'Erhöhe die Obergrenze oder lösche nicht mehr benötigte Videos.',
			link: '/verwaltung/speicher'
		});
		await setSetting(GEWARNT, true, null);
	} else if (anteil < 0.8 && gewarnt) {
		await setSetting(GEWARNT, false, null);
	}
}

// ---------------------------------------------------------------------------
// Rechte und Lesen
// ---------------------------------------------------------------------------

async function einheit(unitId: string) {
	if (!GUID.test(unitId)) throw new MediathekFehler('Ungültige Einheit');
	const [u] = await db.select().from(units).where(eq(units.id, unitId));
	if (!u) throw new MediathekFehler('Einheit nicht gefunden', 404);
	return u;
}

/** Einheiten, für die die Person Videos hochladen darf */
export async function schreibbareEinheiten(p: Principal) {
	const ids = [...mediaUnitIds(p)];
	if (!ids.length) return [];
	const rows = await db.select().from(units).where(inArray(units.id, ids)).orderBy(asc(units.name));
	return rows
		.filter((u) => canWriteMedia(p, u))
		.map((u) => ({ id: u.id, name: u.name, label: unitTypeLabel(u), isCentral: u.isCentral }));
}

/** Video zum Bearbeiten: nur mit Recht in der Einheit */
async function zumBearbeiten(p: Principal, id: string) {
	if (!GUID.test(id)) throw new MediathekFehler('Video nicht gefunden', 404);
	const [v] = await db.select().from(videos).where(eq(videos.id, id));
	if (!v) throw new MediathekFehler('Video nicht gefunden', 404);
	const u = await einheit(v.unitId);
	if (!canWriteMedia(p, u)) throw new MediathekFehler('Dafür fehlt dir das Recht.', 403);
	return { v, u };
}

/** Sichtbares Video (RLS); unveröffentlichte nur mit Recht. null = nicht sichtbar */
export async function sichtbar(p: Principal, id: string) {
	if (!GUID.test(id)) return null;
	const [v] = await scoped(p, (tx) => tx.select().from(videos).where(eq(videos.id, id)));
	if (!v || v.replacesId) return null;
	const [u] = await db.select().from(units).where(eq(units.id, v.unitId));
	if (!u || !canSeeUnit(p, u)) return null;
	const darf = canWriteMedia(p, u);
	if (v.status !== 'veroeffentlicht' && !darf) return null;
	return { v, u, darf };
}

function like(q: string) {
	return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export interface VideoKarte {
	id: string;
	title: string;
	unitId: string;
	unitName: string;
	unitSlug: string;
	unitType: string;
	status: string;
	progress: number;
	durationSec: number;
	publishedAt: Date | null;
	createdAt: Date;
	topics: { id: string; name: string }[];
	darf: boolean;
}

/** Liste für die Übersicht und die Seiten der Einheiten */
export async function videosListe(
	p: Principal,
	opt: { q?: string | null; unitId?: string | null; thema?: string | null; limit?: number } = {}
): Promise<VideoKarte[]> {
	const q = opt.q?.trim().slice(0, 100) ?? '';
	const unitId = opt.unitId && GUID.test(opt.unitId) ? opt.unitId : null;
	const thema =
		opt.thema === 'ohne' ? 'ohne' : opt.thema && GUID.test(opt.thema) ? opt.thema : null;
	const schreibbar = new Set((await schreibbareEinheiten(p)).map((u) => u.id));
	const rows = await scoped(p, (tx) =>
		tx
			.select({
				id: videos.id,
				title: videos.title,
				unitId: videos.unitId,
				unitName: units.name,
				unitSlug: units.slug,
				unitType: units.type,
				status: videos.status,
				progress: videos.progress,
				durationSec: videos.durationSec,
				publishedAt: videos.publishedAt,
				createdAt: videos.createdAt
			})
			.from(videos)
			.innerJoin(units, eq(units.id, videos.unitId))
			.where(
				and(
					isNull(videos.replacesId),
					unitId ? eq(videos.unitId, unitId) : undefined,
					q
						? or(
								ilike(videos.title, like(q)),
								ilike(videos.description, like(q)),
								ilike(videos.captionsText, like(q))
							)
						: undefined,
					thema === 'ohne'
						? sql`not exists (select 1 from video_topics vt where vt.video_id = ${videos.id})`
						: thema
							? sql`exists (select 1 from video_topics vt where vt.video_id = ${videos.id} and vt.topic_id = ${thema})`
							: undefined
				)
			)
			.orderBy(desc(sql`coalesce(${videos.publishedAt}, ${videos.createdAt})`))
			.limit(opt.limit ?? 300)
	);
	const sichtbar = rows.filter((r) => r.status === 'veroeffentlicht' || schreibbar.has(r.unitId));
	const ids = sichtbar.map((r) => r.id);
	const zuordnung = ids.length
		? await scoped(p, (tx) =>
				tx
					.select({ videoId: videoTopics.videoId, id: topics.id, name: topics.name })
					.from(videoTopics)
					.innerJoin(topics, eq(topics.id, videoTopics.topicId))
					.where(inArray(videoTopics.videoId, ids))
					.orderBy(asc(topics.name))
			)
		: [];
	return sichtbar.map((r) => ({
		...r,
		topics: zuordnung.filter((z) => z.videoId === r.id).map(({ id, name }) => ({ id, name })),
		darf: schreibbar.has(r.unitId)
	}));
}

/** Detail zum Ansehen */
export async function videoDetail(p: Principal, id: string) {
	const s = await sichtbar(p, id);
	if (!s) return null;
	const themen = await scoped(p, (tx) =>
		tx
			.select({ id: topics.id, name: topics.name })
			.from(videoTopics)
			.innerJoin(topics, eq(topics.id, videoTopics.topicId))
			.where(eq(videoTopics.videoId, id))
			.orderBy(asc(topics.name))
	);
	const mandanten = s.v.tenantIds?.length
		? await db
				.select({ id: tenants.id, name: tenants.name })
				.from(tenants)
				.where(inArray(tenants.id, s.v.tenantIds))
		: [];
	const anhaenge = await anhaengeVon(id);
	const { keyEnc: _k, captionsVtt, uploadHead: _h, ...rest } = s.v;
	void _k;
	void _h;
	return {
		...rest,
		anhaenge,
		hatUntertitel: Boolean(captionsVtt),
		unit: { id: s.u.id, name: s.u.name, slug: s.u.slug, type: s.u.type, isCentral: s.u.isCentral },
		themen,
		mandanten,
		darf: s.darf
	};
}

// ---------------------------------------------------------------------------
// Hochladen
// ---------------------------------------------------------------------------

export async function videoAnlegen(
	p: Principal,
	input: { unitId: string; title: string; size: number }
) {
	const u = await einheit(input.unitId);
	if (!canWriteMedia(p, u)) throw new MediathekFehler('Dafür fehlt dir das Recht.', 403);
	const title = input.title.trim().slice(0, MAX_TITEL);
	if (!title) throw new MediathekFehler('Gib einen Titel ein.');
	if (!Number.isSafeInteger(input.size) || input.size <= 0)
		throw new MediathekFehler('Die Datei ist leer.');
	if (input.size > MAX_VIDEO_BYTES) throw new MediathekFehler('Die Datei ist größer als 4 GB.');
	const grenze = (await grenzeGb()) * 1024 ** 3;
	if ((await belegtBytes()) + input.size > grenze)
		throw new MediathekFehler('Der Speicher der Mediathek ist voll. Wende dich bitte an die IT.');
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(videos)
		.where(
			and(
				eq(videos.createdBy, p.personId),
				inArray(videos.status, ['hochladen', 'warten', 'umwandeln'])
			)
		);
	if (n >= 3)
		throw new MediathekFehler(
			'Du hast schon 3 Videos in Arbeit. Warte bitte, bis eins fertig ist.'
		);
	const { keyEnc } = newFileKey();
	const [v] = await db
		.insert(videos)
		.values({
			unitId: u.id,
			title,
			keyEnc,
			uploadSize: input.size,
			createdBy: p.personId,
			status: 'hochladen'
		})
		.returning({ id: videos.id });
	await mkdir(ordnerVon(v.id), { recursive: true, mode: 0o700 });
	return v.id;
}

/** Erkennt MP4/MOV (ftyp) und WebM/Matroska am Inhalt */
export function istVideo(kopf: Uint8Array): boolean {
	const b = Buffer.from(kopf);
	if (b.length >= 12 && b.subarray(4, 8).toString('latin1') === 'ftyp') return true;
	if (b.length >= 4 && b.readUInt32BE(0) === 0x1a45dfa3) return true;
	if (
		b.length >= 8 &&
		['moov', 'mdat', 'wide', 'free'].includes(b.subarray(4, 8).toString('latin1'))
	)
		return true;
	return false;
}

/** Einen Teil anhängen; nur in der richtigen Reihenfolge (offset = bisher erhalten) */
export async function teilAnhaengen(p: Principal, id: string, offset: number, teil: Uint8Array) {
	const { v } = await zumBearbeiten(p, id);
	if (v.status !== 'hochladen') throw new MediathekFehler('Das Video wird nicht mehr hochgeladen.');
	if (v.createdBy !== p.personId)
		throw new MediathekFehler('Nur wer das Video hochlädt, kann weitere Teile senden.');
	if (offset !== v.uploadReceived)
		throw new MediathekFehler(`Falscher Teil. Weiter bei Byte ${v.uploadReceived}.`);
	if (teil.length === 0 || teil.length > TEIL_BYTES)
		throw new MediathekFehler('Ungültige Größe des Teils.');
	if (v.uploadReceived + teil.length > v.uploadSize)
		throw new MediathekFehler('Mehr Daten als angekündigt.');
	if (offset === 0 && !istVideo(teil.subarray(0, 16)))
		throw new MediathekFehler('Das ist keine Videodatei. Erlaubt sind MP4, MOV und WebM.');
	const datei = join(ordnerVon(id), 'eingang.bin');
	// Falls ein früherer Versuch mehr geschrieben hat: auf den bestätigten Stand kürzen
	// Ein Dateihandle für Kürzen und Anhängen (keine Lücke zwischen Prüfen und Schreiben)
	const fh = await open(datei, 'a', 0o600);
	try {
		await fh.truncate(offset);
		await fh.appendFile(teil);
	} finally {
		await fh.close();
	}
	const erhalten = offset + teil.length;
	const fertig = erhalten === v.uploadSize;
	await db
		.update(videos)
		.set({
			uploadReceived: erhalten,
			// Zum Fortsetzen nach Abbruch: gleiche Datei am ersten Teil erkennen
			...(offset === 0 ? { uploadHead: createHash('sha256').update(teil).digest('hex') } : {}),
			...(fertig ? { status: 'warten', progress: 0 } : {}),
			updatedAt: new Date()
		})
		.where(eq(videos.id, id));
	if (fertig) {
		// Untertitel erzeugen: neue Videos immer, neue Fassungen nur ohne hochgeladene Untertitel
		const [eltern] = v.replacesId
			? await db
					.select({ quelle: videos.captionsSource, ohne: videos.noCaptionsReason })
					.from(videos)
					.where(eq(videos.id, v.replacesId))
			: [];
		if (eltern?.quelle !== 'hochgeladen' && !eltern?.ohne)
			await writeFile(join(ordnerVon(id), 'untertitel'), '', { mode: 0o600 });
		await writeFile(join(ordnerVon(id), 'auftrag'), '', { mode: 0o600 });
	}
	return { erhalten, fertig };
}

// ---------------------------------------------------------------------------
// Ergebnis der Umwandlung abholen
// ---------------------------------------------------------------------------

async function dateienUnter(ordner: string): Promise<string[]> {
	const out: string[] = [];
	for (const e of await readdir(ordner, { withFileTypes: true })) {
		const p = join(ordner, e.name);
		if (e.isDirectory()) out.push(...(await dateienUnter(p)));
		else if (e.isFile()) out.push(p);
	}
	return out;
}

async function lies(pfad: string): Promise<string | null> {
	try {
		return await readFile(pfad, 'utf8');
	} catch {
		return null;
	}
}

/** Erzeugte Untertitel aus dem Arbeitsordner, bereinigt; null = keine */
async function erzeugteUntertitel(ordner: string, fertig: string) {
	if (!/untertitel=ja/.test(fertig)) return null;
	const roh = await lies(join(ordner, 'aus', 'untertitel.vtt'));
	if (!roh) return null;
	try {
		return vttBereinigen(roh);
	} catch {
		return null;
	}
}

/** Fertig umgewandelt: verschlüsselt an den Speicherort, Arbeitsordner leeren */
export async function einlagern(id: string) {
	const [v] = await db.select().from(videos).where(eq(videos.id, id));
	if (!v) return;
	const ordner = ordnerVon(id);
	const fertig = (await lies(join(ordner, 'fertig'))) ?? '';
	const dauer = Number(/dauer=(\d+)/.exec(fertig)?.[1] ?? 0);
	const hoehen = (/hoehen=([\d,]+)/.exec(fertig)?.[1] ?? '')
		.split(',')
		.map(Number)
		.filter((h) => h > 0);
	const auto = await erzeugteUntertitel(ordner, fertig);
	const ziel = await zielFuer('videos');
	const key = unwrapFileKey(v.keyEnc);
	const aus = join(ordner, 'aus');
	let bytes = 0;
	try {
		for (const datei of await dateienUnter(aus)) {
			const rel = relative(aus, datei).split('\\').join('/');
			if (!/^([a-z0-9_-]+\/)?[a-z0-9_-]+\.(m3u8|mp4|m4s|jpg)$/.test(rel)) continue;
			const inhalt = await readFile(datei);
			const s = `videos/${id}/${rel}`;
			const enc = encryptFile(inhalt, key, s);
			await medienSchreiben(ziel, s, enc);
			bytes += enc.length;
		}
	} catch (err) {
		await medienLoeschen(ziel, id).catch(() => undefined);
		throw err;
	}
	const medien = { durationSec: dauer, heights: hoehen, bytes, storageTargetId: ziel };
	const autoFelder = auto
		? {
				captionsVtt: auto.vtt,
				captionsText: auto.text,
				captionsSource: 'automatisch' as const,
				captionsCheckedAt: null,
				captionsCheckedBy: null
			}
		: {};

	if (v.replacesId) {
		await ersatzTauschen(v, medien, auto, autoFelder);
	} else {
		await db
			.update(videos)
			.set({ status: 'entwurf', progress: 100, ...medien, ...autoFelder, updatedAt: new Date() })
			.where(eq(videos.id, id));
		if (v.createdBy)
			await notify('nachrichten', [v.createdBy], {
				title: `Dein Video „${v.title}“ ist fertig umgewandelt.`,
				detail: auto
					? 'Die Untertitel wurden automatisch erzeugt. Prüfe sie, dann kannst du es veröffentlichen.'
					: 'Füge Untertitel hinzu, dann kannst du es veröffentlichen.',
				link: `/mediathek/${id}/bearbeiten`
			});
	}
	await rm(ordner, { recursive: true, force: true });
	await grenzePruefen();
}

/**
 * Neue Fassung fertig: Medien des vorhandenen Videos tauschen (Präfix media_id),
 * alte Medien löschen, Kapitel kürzen, Untertitel behalten (hochgeladen) oder
 * durch die neu erzeugten ersetzen (automatisch).
 */
async function ersatzTauschen(
	neu: typeof videos.$inferSelect,
	medien: { durationSec: number; heights: number[]; bytes: number; storageTargetId: string | null },
	auto: { vtt: string; text: string } | null,
	autoFelder: Record<string, unknown>
) {
	const [alt] = await db
		.select()
		.from(videos)
		.where(eq(videos.id, neu.replacesId as string));
	if (!alt) {
		await medienLoeschen(medien.storageTargetId, neu.id).catch(() => undefined);
		await db.delete(videos).where(eq(videos.id, neu.id));
		return;
	}
	const hochgeladen =
		(alt.captionsSource === 'hochgeladen' && Boolean(alt.captionsVtt)) ||
		Boolean(alt.noCaptionsReason);
	const untertitel = hochgeladen
		? {}
		: auto
			? autoFelder
			: {
					captionsVtt: null,
					captionsText: '',
					captionsSource: null,
					captionsCheckedAt: null,
					captionsCheckedBy: null
				};
	const kapitel = alt.chapters.filter((k) => k.s < medien.durationSec);
	const freigegeben = hochgeladen;
	const status = alt.status === 'veroeffentlicht' && !freigegeben ? 'entwurf' : alt.status;
	const altesZiel = alt.storageTargetId;
	const altesPraefix = alt.mediaId ?? alt.id;
	await db.transaction(async (tx) => {
		await tx
			.update(videos)
			.set({
				...medien,
				keyEnc: neu.keyEnc,
				mediaId: neu.id,
				chapters: kapitel,
				status,
				...untertitel,
				updatedAt: new Date()
			})
			.where(eq(videos.id, alt.id));
		await tx.delete(videos).where(eq(videos.id, neu.id));
	});
	await medienLoeschen(altesZiel, altesPraefix).catch((err) =>
		console.error('Alte Medien nicht gelöscht:', err?.message)
	);
	const an = [...new Set([neu.createdBy, alt.createdBy].filter((x): x is string => Boolean(x)))];
	if (an.length)
		await notify('nachrichten', an, {
			title: `Die neue Fassung von „${alt.title}“ ist da.`,
			detail:
				status !== alt.status
					? 'Das Video ist wieder ein Entwurf: Prüfe die Untertitel, dann veröffentliche es erneut.'
					: 'Prüfe Kapitel und Untertitel, ob sie noch passen.',
			link: `/mediathek/${alt.id}/bearbeiten`
		});
}

let abholen: Promise<void> | null = null;

/** Stand der Umwandlung übernehmen, fertige Videos einlagern, alte Uploads entfernen */
export function umwandlungAbholen(): Promise<void> {
	abholen ??= (async () => {
		const offen = await db
			.select({
				id: videos.id,
				status: videos.status,
				title: videos.title,
				createdBy: videos.createdBy
			})
			.from(videos)
			.where(inArray(videos.status, ['warten', 'umwandeln']));
		for (const v of offen) {
			const ordner = ordnerVon(v.id);
			const fehler = await lies(join(ordner, 'fehler'));
			if (fehler !== null) {
				await db
					.update(videos)
					.set({
						status: 'fehler',
						errorMessage: fehler.trim().slice(0, 200),
						updatedAt: new Date()
					})
					.where(eq(videos.id, v.id));
				await rm(ordner, { recursive: true, force: true });
				if (v.createdBy)
					await notify('nachrichten', [v.createdBy], {
						title: `Dein Video „${v.title}“ ließ sich nicht umwandeln.`,
						detail: fehler.trim().slice(0, 200),
						link: `/mediathek/${v.id}/bearbeiten`
					});
				continue;
			}
			if ((await lies(join(ordner, 'fertig'))) !== null) {
				try {
					await einlagern(v.id);
				} catch (err) {
					console.error('Video einlagern fehlgeschlagen:', (err as Error)?.message);
				}
				continue;
			}
			const pro = Number((await lies(join(ordner, 'fortschritt')))?.trim());
			if (Number.isFinite(pro))
				await db
					.update(videos)
					.set({ status: 'umwandeln', progress: Math.max(0, Math.min(99, pro)) })
					.where(eq(videos.id, v.id));
		}
		// Abgebrochene Uploads nach 24 Stunden entfernen
		const alt = await db
			.delete(videos)
			.where(
				and(eq(videos.status, 'hochladen'), lt(videos.updatedAt, sql`now() - interval '24 hours'`))
			)
			.returning({ id: videos.id });
		for (const a of alt) await rm(ordnerVon(a.id), { recursive: true, force: true });
	})().finally(() => {
		abholen = null;
	});
	return abholen;
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startMediathek() {
	if (timer) return;
	timer = setInterval(() => {
		void umwandlungAbholen().catch((err) => console.error('Mediathek:', err?.message));
	}, 5000);
	timer.unref?.();
}

// ---------------------------------------------------------------------------
// Medien ausliefern
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
	m3u8: 'application/vnd.apple.mpegurl',
	mp4: 'video/mp4',
	m4s: 'video/iso.segment',
	jpg: 'image/jpeg'
};

/** Entschlüsselte Mediendatei; null = nicht sichtbar oder nicht vorhanden */
export async function medium(p: Principal, id: string, rel: string) {
	if (!/^([a-z0-9_-]{1,40}\/)?[a-z0-9_-]{1,60}\.(m3u8|mp4|m4s|jpg)$/.test(rel)) return null;
	const s = await sichtbar(p, id);
	if (!s || !['entwurf', 'veroeffentlicht'].includes(s.v.status)) return null;
	const k = `videos/${s.v.mediaId ?? id}/${rel}`;
	try {
		const roh = await medienLesen(s.v.storageTargetId, k);
		const data = decryptFile(roh, unwrapFileKey(s.v.keyEnc), k);
		return { data, mime: MIME[rel.split('.').pop() as string] };
	} catch {
		return null;
	}
}

export async function untertitel(p: Principal, id: string): Promise<string | null> {
	const s = await sichtbar(p, id);
	return s?.v.captionsVtt ?? null;
}

// ---------------------------------------------------------------------------
// Bearbeiten
// ---------------------------------------------------------------------------

export async function bearbeitenDaten(p: Principal, id: string) {
	const { v, u } = await zumBearbeiten(p, id);
	const themen = await db
		.select({ id: videoTopics.topicId })
		.from(videoTopics)
		.where(eq(videoTopics.videoId, id));
	const mandanten = u.isCentral
		? await db
				.select({ id: tenants.id, name: tenants.name })
				.from(tenants)
				.orderBy(asc(tenants.name))
		: [];
	const { keyEnc: _k, ...rest } = v;
	void _k;
	return {
		...rest,
		unit: { id: u.id, name: u.name, slug: u.slug, type: u.type, isCentral: u.isCentral },
		themenIds: themen.map((t) => t.id),
		mandanten
	};
}

export async function metaSpeichern(
	p: Principal,
	id: string,
	input: { title: string; description: string; themen: string[]; tenantIds: string[] | null }
) {
	const { u } = await zumBearbeiten(p, id);
	const title = input.title.trim().slice(0, MAX_TITEL);
	if (!title) throw new MediathekFehler('Gib einen Titel ein.');
	const description = input.description.trim().slice(0, MAX_BESCHREIBUNG);
	let tenantIds: string[] | null = null;
	if (u.isCentral && input.tenantIds?.length) {
		const ok = await db
			.select({ id: tenants.id })
			.from(tenants)
			.where(
				inArray(
					tenants.id,
					input.tenantIds.filter((t) => GUID.test(t))
				)
			);
		tenantIds = ok.length ? ok.map((t) => t.id) : null;
	}
	await db
		.update(videos)
		.set({ title, description, tenantIds, updatedAt: new Date() })
		.where(eq(videos.id, id));
	await themenSetzen('video', id, await gueltigeThemen(input.themen));
}

/**
 * Alles zwischen „<“ und „>“ samt Klammern entfernen, ebenso einzelne Klammern.
 * Zeichenweise statt mit regulären Ausdrücken: Es bleibt keine spitze Klammer übrig.
 */
export function ohneMarkup(zeile: string): string {
	let out = '';
	let inTag = false;
	for (const c of zeile) {
		if (c === '<') inTag = true;
		else if (c === '>') inTag = false;
		else if (!inTag) out += c;
	}
	return out;
}

/** WebVTT prüfen und bereinigt speichern (nur Zeiten und reiner Text) */
export function vttBereinigen(raw: string): { vtt: string; text: string } {
	if (raw.length > 2_000_000)
		throw new MediathekFehler('Die Untertiteldatei ist zu groß (höchstens 2 MB).');
	const zeilen = raw
		.replace(/^\uFEFF/, '')
		.replace(/\r\n?/g, '\n')
		.split('\n');
	if (!/^WEBVTT(\s|$)/.test(zeilen[0] ?? ''))
		throw new MediathekFehler('Das ist keine WebVTT-Datei (erste Zeile „WEBVTT“).');
	const ZEIT = /^((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})/;
	const out = ['WEBVTT', ''];
	const texte: string[] = [];
	let i = 1;
	let anzahl = 0;
	while (i < zeilen.length) {
		const m = ZEIT.exec(zeilen[i]);
		if (!m) {
			i++;
			continue;
		}
		i++;
		const text: string[] = [];
		while (i < zeilen.length && zeilen[i].trim() !== '') {
			// Nur reiner Text: Tags und Steuerzeichen weg
			const t = ohneMarkup(zeilen[i])
				// eslint-disable-next-line no-control-regex -- Steuerzeichen entfernen ist der Zweck
				.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
				.slice(0, 300);
			// Ohne „>“ kann kein Zeitpfeil („-->“) mehr im Text stehen
			if (t.trim()) text.push(t);
			i++;
		}
		if (!text.length) continue;
		out.push(`${m[1]} --> ${m[2]}`, ...text, '');
		texte.push(text.join(' '));
		if (++anzahl > 20_000) throw new MediathekFehler('Zu viele Untertitel.');
	}
	if (!anzahl) throw new MediathekFehler('In der Datei stehen keine Untertitel.');
	return { vtt: out.join('\n'), text: texte.join(' ').slice(0, 200_000) };
}

export async function untertitelSetzen(p: Principal, id: string, raw: string | null) {
	await zumBearbeiten(p, id);
	if (raw === null) {
		await db
			.update(videos)
			.set({
				captionsVtt: null,
				captionsText: '',
				captionsSource: null,
				captionsCheckedAt: null,
				captionsCheckedBy: null,
				updatedAt: new Date()
			})
			.where(eq(videos.id, id));
		// Ohne Untertitel (und ohne Grund) nicht veröffentlicht
		await db
			.update(videos)
			.set({ status: 'entwurf', publishedAt: null })
			.where(
				and(
					eq(videos.id, id),
					eq(videos.status, 'veroeffentlicht'),
					isNull(videos.noCaptionsReason)
				)
			);
		return;
	}
	const { vtt, text } = vttBereinigen(raw);
	await db
		.update(videos)
		.set({
			captionsVtt: vtt,
			captionsText: text,
			captionsSource: 'hochgeladen',
			captionsCheckedAt: null,
			captionsCheckedBy: null,
			noCaptionsReason: null,
			updatedAt: new Date()
		})
		.where(eq(videos.id, id));
}

/** Untertitel als Liste (zum Korrigieren): Anfang, Ende als Text, Text */
export function cuesAus(vtt: string | null): { a: string; b: string; t: string }[] {
	if (!vtt) return [];
	const out: { a: string; b: string; t: string }[] = [];
	for (const block of vtt.split(/\n\n+/)) {
		const [zeit, ...text] = block.split('\n');
		const m = /^(\S+) --> (\S+)$/.exec(zeit ?? '');
		if (m) out.push({ a: m[1], b: m[2], t: text.join('\n').replace(/\n+$/, '') });
	}
	return out;
}

/** Korrigierte Texte übernehmen; Zeiten bleiben, wie sie sind (geprüft über vttBereinigen) */
export async function untertitelKorrigieren(p: Principal, id: string, texte: unknown) {
	const { v } = await zumBearbeiten(p, id);
	const cues = cuesAus(v.captionsVtt);
	if (!cues.length) throw new MediathekFehler('Es gibt noch keine Untertitel.');
	if (!Array.isArray(texte) || texte.length !== cues.length)
		throw new MediathekFehler('Die Untertitel haben sich inzwischen geändert. Lade die Seite neu.');
	const roh = [
		'WEBVTT',
		'',
		...cues.flatMap((c, i) => [`${c.a} --> ${c.b}`, String(texte[i] ?? '').slice(0, 600), ''])
	].join('\n');
	// Leere Texte fallen in vttBereinigen weg
	const { vtt, text } = vttBereinigen(roh);
	await db
		.update(videos)
		.set({ captionsVtt: vtt, captionsText: text, updatedAt: new Date() })
		.where(eq(videos.id, id));
}

/** Automatische Untertitel als geprüft markieren (oder zurücknehmen) */
export async function untertitelPruefen(p: Principal, id: string, geprueft: boolean) {
	const { v } = await zumBearbeiten(p, id);
	if (!v.captionsVtt) throw new MediathekFehler('Es gibt noch keine Untertitel.');
	await db
		.update(videos)
		.set(
			geprueft
				? { captionsCheckedAt: new Date(), captionsCheckedBy: p.personId }
				: { captionsCheckedAt: null, captionsCheckedBy: null }
		)
		.where(eq(videos.id, id));
	if (!geprueft && v.captionsSource === 'automatisch')
		await db
			.update(videos)
			.set({ status: 'entwurf' })
			.where(and(eq(videos.id, id), eq(videos.status, 'veroeffentlicht')));
}

/** Darf veröffentlicht werden: Untertitel vorhanden und, wenn automatisch, geprüft */
export function untertitelBereit(v: {
	captionsVtt: string | null;
	captionsSource: string | null;
	captionsCheckedAt: Date | null;
	noCaptionsReason?: string | null;
}): boolean {
	if (!v.captionsVtt) return Boolean(v.noCaptionsReason);
	return v.captionsSource !== 'automatisch' || Boolean(v.captionsCheckedAt);
}

/** Bewusst ohne Untertitel (mit Grund) oder wieder mit Untertitel-Pflicht (null) */
export async function ohneUntertitel(p: Principal, id: string, grund: string | null) {
	const { v } = await zumBearbeiten(p, id);
	if (grund !== null && !(grund in OHNE_UNTERTITEL))
		throw new MediathekFehler('Wähle einen Grund aus.');
	if (grund) {
		// Vorhandene Untertitel fallen weg
		await db
			.update(videos)
			.set({
				noCaptionsReason: grund as OhneUntertitelGrund,
				captionsVtt: null,
				captionsText: '',
				captionsSource: null,
				captionsCheckedAt: null,
				captionsCheckedBy: null,
				updatedAt: new Date()
			})
			.where(eq(videos.id, id));
		return;
	}
	await db
		.update(videos)
		.set({ noCaptionsReason: null, updatedAt: new Date() })
		.where(eq(videos.id, id));
	// Ohne Untertitel und ohne Grund nicht veröffentlicht
	if (!v.captionsVtt)
		await db
			.update(videos)
			.set({ status: 'entwurf' })
			.where(and(eq(videos.id, id), eq(videos.status, 'veroeffentlicht')));
}

export async function kapitelSetzen(p: Principal, id: string, liste: Kapitel[]) {
	const { v } = await zumBearbeiten(p, id);
	if (!Array.isArray(liste) || liste.length > MAX_KAPITEL)
		throw new MediathekFehler(`Höchstens ${MAX_KAPITEL} Kapitel.`);
	const sauber = liste.map((k) => ({ s: Math.floor(Number(k?.s)), t: String(k?.t ?? '').trim() }));
	const fehler = kapitelFehler(sauber, v.durationSec).filter(Boolean);
	if (fehler.length) throw new MediathekFehler(`Bitte prüfe die Kapitel: ${fehler[0]}.`);
	await db.update(videos).set({ chapters: sauber, updatedAt: new Date() }).where(eq(videos.id, id));
}

export async function veroeffentlichen(p: Principal, id: string, an: boolean) {
	const { v } = await zumBearbeiten(p, id);
	if (an) {
		if (v.status !== 'entwurf')
			throw new MediathekFehler('Das Video ist noch nicht fertig umgewandelt.');
		if (!v.captionsVtt && !v.noCaptionsReason)
			throw new MediathekFehler(
				'Füge zuerst Untertitel hinzu oder gib an, warum das Video keine braucht.'
			);
		if (!untertitelBereit(v))
			throw new MediathekFehler('Prüfe zuerst die automatisch erzeugten Untertitel.');
		await db
			.update(videos)
			.set({
				status: 'veroeffentlicht',
				publishedAt: v.publishedAt ?? new Date(),
				updatedAt: new Date()
			})
			.where(eq(videos.id, id));
	} else if (v.status === 'veroeffentlicht') {
		await db
			.update(videos)
			.set({ status: 'entwurf', updatedAt: new Date() })
			.where(eq(videos.id, id));
	}
}

export async function videoLoeschen(p: Principal, id: string) {
	const { v } = await zumBearbeiten(p, id);
	const ersatz = await db.select({ id: videos.id }).from(videos).where(eq(videos.replacesId, id));
	const dateien = (await anhaengeVon(id)).map((a) => a.id);
	await db.delete(videos).where(eq(videos.id, id));
	for (const e of [id, ...ersatz.map((x) => x.id)])
		await rm(ordnerVon(e), { recursive: true, force: true });
	await deleteStored(dateien);
	if (['entwurf', 'veroeffentlicht'].includes(v.status))
		await medienLoeschen(v.storageTargetId, v.mediaId ?? id).catch((err) =>
			console.error('Medien nicht gelöscht:', err?.message)
		);
	return v.title;
}

// ---------------------------------------------------------------------------
// Textfassung und Anhänge
// ---------------------------------------------------------------------------

export async function anhaengeVon(videoId: string) {
	return db
		.select({ id: files.id, name: files.name, size: files.size, kind: files.kind })
		.from(videoAttachments)
		.innerJoin(files, eq(files.id, videoAttachments.fileId))
		.where(eq(videoAttachments.videoId, videoId))
		.orderBy(asc(videoAttachments.position));
}

export async function textSpeichern(
	p: Principal,
	id: string,
	input: { html: string; anhaenge: string[] }
) {
	await zumBearbeiten(p, id);
	const html = cleanHtml(input.html.slice(0, 400_000));
	if (htmlToText(html).length > 100_000) throw new MediathekFehler('Die Textfassung ist zu lang.');
	const wanted = [...new Set(input.anhaenge.filter((x) => GUID.test(x)))];
	if (wanted.length > MAX_ATTACHMENTS)
		throw new MediathekFehler(`Höchstens ${MAX_ATTACHMENTS} Anhänge je Video.`);
	const current = (await anhaengeVon(id)).map((a) => a.id);
	const fresh = wanted.filter((x) => !current.includes(x));
	if (fresh.length && (await ownUnlinkedFiles(p.personId, fresh)).length !== fresh.length)
		throw new MediathekFehler('Ein Anhang ist nicht mehr verfügbar. Lade ihn bitte erneut hoch.');
	const removed = current.filter((x) => !wanted.includes(x));
	await db.transaction(async (tx) => {
		await tx
			.update(videos)
			.set({ transcriptHtml: html, updatedAt: new Date() })
			.where(eq(videos.id, id));
		await tx.delete(videoAttachments).where(eq(videoAttachments.videoId, id));
		if (wanted.length)
			await tx
				.insert(videoAttachments)
				.values(wanted.map((fileId, position) => ({ videoId: id, fileId, position })));
	});
	await deleteStored(removed);
}

/** Für /dateien/<id>: Anhang eines Videos, das die Person sehen darf */
export async function videoDateiErlaubt(p: Principal, fileId: string): Promise<boolean> {
	if (!GUID.test(fileId)) return false;
	const [a] = await db
		.select({ videoId: videoAttachments.videoId })
		.from(videoAttachments)
		.where(eq(videoAttachments.fileId, fileId));
	return Boolean(a && (await sichtbar(p, a.videoId)));
}

// ---------------------------------------------------------------------------
// Neue Fassung (Videodatei ersetzen) und Fortsetzen nach Abbruch
// ---------------------------------------------------------------------------

/** Laufender Ersatz zu einem Video (höchstens einer) */
export async function ersatzVon(id: string) {
	const [e] = await db
		.select({
			id: videos.id,
			status: videos.status,
			progress: videos.progress,
			errorMessage: videos.errorMessage,
			uploadSize: videos.uploadSize,
			uploadReceived: videos.uploadReceived,
			createdBy: videos.createdBy
		})
		.from(videos)
		.where(eq(videos.replacesId, id))
		.orderBy(desc(videos.createdAt))
		.limit(1);
	return e ?? null;
}

export async function ersatzAnlegen(p: Principal, id: string, size: number) {
	const { v } = await zumBearbeiten(p, id);
	if (v.replacesId) throw new MediathekFehler('Video nicht gefunden', 404);
	if (!['entwurf', 'veroeffentlicht'].includes(v.status))
		throw new MediathekFehler('Das Video ist noch nicht fertig umgewandelt.');
	const laufend = await ersatzVon(id);
	if (laufend && laufend.status !== 'fehler')
		throw new MediathekFehler('Es wird schon eine neue Fassung hochgeladen oder umgewandelt.');
	if (laufend) await db.delete(videos).where(eq(videos.id, laufend.id));
	const neu = await videoAnlegen(p, { unitId: v.unitId, title: v.title, size });
	await db.update(videos).set({ replacesId: id }).where(eq(videos.id, neu));
	return neu;
}

/** Stand eines abgebrochenen Uploads (nur für die Person, die hochlädt) */
export async function uploadStand(p: Principal, id: string) {
	const { v } = await zumBearbeiten(p, id);
	if (v.status !== 'hochladen' || v.createdBy !== p.personId)
		throw new MediathekFehler('Dieses Hochladen lässt sich nicht fortsetzen.');
	return { erhalten: v.uploadReceived, groesse: v.uploadSize, kopf: v.uploadHead };
}

/** Für Prüfungen: Speicherort hat Videos */
export async function videosAmZiel(targetId: string): Promise<number> {
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(videos)
		.where(eq(videos.storageTargetId, targetId));
	return n;
}

/** Abschnitt „Mediathek“ auf den Seiten der Abteilungen und Hubs */
export async function einheitVideos(p: Principal, unitId: string) {
	const [liste, schreibbar] = await Promise.all([
		videosListe(p, { unitId, limit: 40 }),
		schreibbareEinheiten(p)
	]);
	const darf = schreibbar.some((u) => u.id === unitId);
	const veroeffentlicht = liste.filter((v) => v.status === 'veroeffentlicht');
	return {
		videos: (darf ? liste : veroeffentlicht).slice(0, 6),
		anzahl: veroeffentlicht.length,
		darf
	};
}

/** Globale Suche (Kap. 8.14): nur veröffentlichte Videos */
export async function searchVideos(p: Principal, tsq: string, limit = 20) {
	const document = doc(videos.title, sql`${videos.description} || ' ' || ${videos.captionsText}`);
	return scoped(p, (tx) =>
		tx
			.select({
				id: videos.id,
				title: videos.title,
				unitName: units.name,
				durationSec: videos.durationSec,
				snippet: headline(sql`${videos.description} || ' ' || ${videos.captionsText}`, tsq)
			})
			.from(videos)
			.innerJoin(units, eq(units.id, videos.unitId))
			.where(
				and(isNull(units.archivedAt), eq(videos.status, 'veroeffentlicht'), matches(document, tsq))
			)
			.orderBy(sql`${rank(document, tsq)} desc`)
			.limit(limit)
	);
}
