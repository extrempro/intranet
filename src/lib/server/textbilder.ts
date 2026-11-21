/**
 * Bilder im Text (Editor) von Beiträgen und FAQs: prüfen, verknüpfen und
 * Rechte beim Abruf. Hochgeladen werden sie wie Anhänge (/dateien), sind
 * verschlüsselt und nur für Personen sichtbar, die den Beitrag sehen dürfen.
 */
import { and, eq, inArray, lte, notInArray } from 'drizzle-orm';
import {
	alleBilderBeschrieben,
	bildIdsImText,
	MAX_BILDER_IM_TEXT,
	MAX_TEXTBILD_BYTES
} from '../bilder-im-text.ts';
import type { Principal } from './auth/access.ts';
import { db, scoped } from './db/index.ts';
import { faqs, files, news, textImages } from './db/schema.ts';
import { ownUnlinkedFiles } from './files/store.ts';
import { cleanHtml } from './html.ts';

export type Besitzer = { art: 'news' | 'faq'; id?: string | null };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const BILDARTEN = ['jpeg', 'png', 'webp'];
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const spalte = (b: Besitzer) => (b.art === 'news' ? textImages.newsId : textImages.faqId);

/**
 * Text bereinigen und Bilder prüfen: erlaubt sind Bilder, die schon zu diesem
 * Beitrag gehören, und eigene, noch nicht verknüpfte Uploads (nur Bilder).
 * Fremde Bilder fallen weg. Jedes Bild braucht eine Beschreibung.
 */
export async function textMitBildern(
	p: Principal,
	html: string,
	besitzer: Besitzer
): Promise<{ html: string; bilder: string[]; fehler?: string }> {
	const ids = bildIdsImText(html).filter((x) => GUID.test(x));
	let erlaubt: string[] = [];
	if (ids.length) {
		const vorhanden = besitzer.id
			? (
					await db
						.select({ id: textImages.fileId })
						.from(textImages)
						.where(and(eq(spalte(besitzer), besitzer.id), inArray(textImages.fileId, ids)))
				).map((r) => r.id)
			: [];
		const frisch = await ownUnlinkedFiles(
			p.personId,
			ids.filter((x) => !vorhanden.includes(x))
		);
		const bilder = frisch.length
			? (
					await db
						.select({ id: files.id })
						.from(files)
						.where(
							and(
								inArray(files.id, frisch),
								inArray(files.kind, BILDARTEN),
								lte(files.size, MAX_TEXTBILD_BYTES)
							)
						)
				).map((r) => r.id)
			: [];
		erlaubt = ids.filter((x) => vorhanden.includes(x) || bilder.includes(x));
	}
	const sauber = cleanHtml(html, new Set(erlaubt));
	const bilder = bildIdsImText(sauber);
	if (bilder.length > MAX_BILDER_IM_TEXT)
		return { html: sauber, bilder, fehler: `Höchstens ${MAX_BILDER_IM_TEXT} Bilder im Text.` };
	if (!alleBilderBeschrieben(sauber))
		return {
			html: sauber,
			bilder,
			fehler: 'Bitte beschreibe jedes Bild im Text kurz (Bildbeschreibung für Bildschirmleser).'
		};
	return { html: sauber, bilder };
}

/** Nach dem Speichern: genau diese Bilder gehören zum Beitrag; entfernte werden frei (24 h). */
export async function bilderVerknuepfen(
	tx: Tx,
	besitzer: Besitzer & { id: string },
	ids: string[]
) {
	await tx
		.delete(textImages)
		.where(
			and(
				eq(spalte(besitzer), besitzer.id),
				ids.length ? notInArray(textImages.fileId, ids) : undefined
			)
		);
	if (!ids.length) return;
	await tx
		.insert(textImages)
		.values(
			ids.map((fileId) =>
				besitzer.art === 'news' ? { fileId, newsId: besitzer.id } : { fileId, faqId: besitzer.id }
			)
		)
		.onConflictDoNothing();
}

/** Abruf über /dateien/<ID>: nur, wer den Beitrag bzw. die FAQ sehen darf. */
export async function textBildErlaubt(p: Principal, fileId: string): Promise<boolean> {
	if (!GUID.test(fileId)) return false;
	const [row] = await db
		.select({ newsId: textImages.newsId, faqId: textImages.faqId, channel: news.channel })
		.from(textImages)
		.leftJoin(news, eq(news.id, textImages.newsId))
		.where(eq(textImages.fileId, fileId));
	if (!row) return false;
	if (row.newsId) {
		if (row.channel === 'kulissen') {
			const { getPost } = await import('./kulissen.ts');
			return Boolean(await getPost(p, row.newsId));
		}
		const { getNews } = await import('./news.ts');
		return Boolean(await getNews(p, row.newsId));
	}
	if (row.faqId) {
		const faqId = row.faqId;
		const sichtbar = await scoped(p, (tx) =>
			tx.select({ id: faqs.id }).from(faqs).where(eq(faqs.id, faqId))
		);
		return sichtbar.length > 0;
	}
	return false;
}
