/**
 * Handbuch (Kap. 13): Artikel aus src/lib/handbuch/*.md, nach Rolle gefiltert.
 * Die Inhalte stammen aus dem Repo; das HTML wird trotzdem bereinigt.
 */
import { marked } from 'marked';
import {
	fitsRoles,
	HANDBOOK_CHAPTERS,
	parseArticle,
	type HandbookMeta,
	type HandbookRole
} from '../handbook.ts';
import { canSeeAdministration, type Principal } from './auth/access.ts';
import { cleanHtml, htmlToText } from './html.ts';

const files = import.meta.glob('../handbuch/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

const articles = Object.entries(files)
	.map(([path, raw]) => {
		const slug = path.replace(/^.*\//, '').replace(/\.md$/, '');
		const { meta, body } = parseArticle(slug, raw);
		const html = cleanHtml(marked.parse(body, { async: false, gfm: true }));
		return { meta, html, text: htmlToText(html) };
	})
	.sort(
		(a, b) =>
			HANDBOOK_CHAPTERS.findIndex((c) => c.key === a.meta.chapter) -
				HANDBOOK_CHAPTERS.findIndex((c) => c.key === b.meta.chapter) ||
			a.meta.order - b.meta.order ||
			a.meta.title.localeCompare(b.meta.title, 'de')
	);

/** Rollen der Person für den Filter. */
export function handbookRoles(p: Principal): Set<HandbookRole> {
	const r = new Set<HandbookRole>(['alle']);
	const has = (role: string) => p.roles.some((x) => x.role === role);
	if (
		p.memberships.some(
			(m) => m.mayWriteNews || m.mayWriteFaqs || m.mayWriteEvents || m.mayWriteBehindScenes
		) ||
		has('abteilungsverwaltung') ||
		has('hub_team')
	)
		r.add('schreiben');
	if (has('abteilungsverwaltung')) r.add('abteilungsverwaltung');
	if (has('hub_team')) r.add('hub_team');
	if (has('redaktion')) r.add('redaktion');
	if (has('moderation_schwarzes_brett')) r.add('moderation');
	if (has('fachpflege')) r.add('fachpflege');
	if (has('vereinbarungen_pflegen')) r.add('vereinbarungen');
	if (has('organigramm_pflegen')) r.add('organigramm');
	if (canSeeAdministration(p)) r.add('verwaltung');
	return r;
}

export function handbookIndex(p: Principal, all: boolean) {
	const mine = handbookRoles(p);
	const list = articles.filter((a) => all || fitsRoles(a.meta, mine));
	return {
		chapters: HANDBOOK_CHAPTERS.map((c) => ({
			...c,
			articles: list
				.filter((a) => a.meta.chapter === c.key)
				.map((a) => ({ ...a.meta, text: a.text.slice(0, 4000) }))
		})).filter((c) => c.articles.length),
		hidden: articles.length - list.length
	};
}

export function handbookArticle(slug: string): { meta: HandbookMeta; html: string } | null {
	const a = articles.find((x) => x.meta.slug === slug);
	return a ? { meta: a.meta, html: a.html } : null;
}

export function handbookAll() {
	return articles.map((a) => a.meta);
}
