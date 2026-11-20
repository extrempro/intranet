/**
 * Globale Suche (Kap. 8.14) über Personen, Abteilungen, Zuständigkeiten,
 * Beiträge, FAQs, Termine, Hubs, Schwarzes Brett und Hinter den Kulissen.
 * Jede Quelle prüft ihre Sichtbarkeit selbst (Rechte und Mandantengrenzen).
 */
import { matchesSearch } from '../departments.ts';
import { searchTerms, toTsQuery, type SearchKind } from '../search.ts';
import type { Principal } from './auth/access.ts';
import { searchAds } from './board.ts';
import { searchEvents } from './calendar.ts';
import { listDepartments } from './departments.ts';
import { searchFaqs } from './faqs.ts';
import { listHubs } from './hubs.ts';
import { searchPosts } from './kulissen.ts';
import { searchNews } from './news.ts';
import { searchPersons } from './people.ts';

export interface SearchHit {
	kind: SearchKind;
	id: string;
	title: string;
	href: string;
	/** Kurzinfo, z. B. Abteilung oder Datum */
	meta: string;
	/** Ausschnitt mit Marken (splitMarks) */
	snippet?: string;
	foto?: string | null;
}

const fmtDate = new Intl.DateTimeFormat('de-DE', {
	dateStyle: 'medium',
	timeZone: 'Europe/Berlin'
});

function day(d: string) {
	const [y, m, dd] = d.split('-').map(Number);
	return fmtDate.format(new Date(Date.UTC(y, m - 1, dd, 12)));
}

/** Alle Arten (oder eine), je Art höchstens `limit` Treffer. */
export async function search(
	p: Principal,
	q: string,
	opts: { kinds?: SearchKind[]; limit?: number } = {}
): Promise<Record<SearchKind, SearchHit[]>> {
	const empty = () =>
		({
			personen: [],
			einheiten: [],
			zustaendigkeiten: [],
			beitraege: [],
			faqs: [],
			termine: [],
			hubs: [],
			brett: [],
			kulissen: []
		}) as Record<SearchKind, SearchHit[]>;
	const out = empty();
	const tsq = toTsQuery(q);
	if (!tsq) return out;
	const want = (k: SearchKind) => !opts.kinds || opts.kinds.includes(k);
	const limit = Math.min(opts.limit ?? 20, 50);
	const text = searchTerms(q).join(' ');

	const [personen, abteilungen, beitraege, faqs, termine, hubs, brett, kulissen] =
		await Promise.all([
			want('personen') ? searchPersons(p, q, tsq, limit) : [],
			want('einheiten') || want('zustaendigkeiten') ? listDepartments(p) : [],
			want('beitraege') ? searchNews(p, tsq, limit) : [],
			want('faqs') ? searchFaqs(p, tsq, limit) : [],
			want('termine') ? searchEvents(p, tsq, limit) : [],
			want('hubs') ? listHubs(p) : [],
			want('brett') ? searchAds(p, tsq, limit) : [],
			want('kulissen') ? searchPosts(p, tsq, limit) : []
		]);

	out.personen = personen.map((x) => ({
		kind: 'personen',
		id: x.id,
		title: x.name,
		href: `/personen/${x.id}`,
		meta: x.position ?? '',
		foto: x.foto
	}));
	if (want('einheiten'))
		out.einheiten = abteilungen
			.filter((u) => matchesSearch(text, [u.name, u.label]))
			.slice(0, limit)
			.map((u) => ({
				kind: 'einheiten',
				id: u.id,
				title: u.name,
				href: `/abteilungen/${u.slug}`,
				meta: [u.label, u.isCentral ? 'für alle Mandanten' : u.tenantShort].join(' · ')
			}));
	if (want('zustaendigkeiten'))
		out.zustaendigkeiten = abteilungen
			.flatMap((u) =>
				u.zustaendigkeiten
					.filter((z) => matchesSearch(text, [z.topic, z.groupName, ...z.keywords]))
					.map((z) => ({
						kind: 'zustaendigkeiten' as const,
						id: z.id,
						title: z.topic,
						href: `/abteilungen/${u.slug}`,
						meta: [
							z.kontakt ? `${z.kontakt.name}${z.kontakt.vertretung ? ' (Vertretung)' : ''}` : null,
							u.name
						]
							.filter(Boolean)
							.join(' · ')
					}))
			)
			.slice(0, limit);
	out.beitraege = beitraege.map((x) => ({
		kind: 'beitraege',
		id: x.id,
		title: x.title,
		href: `/neuigkeiten/${x.id}`,
		meta: `${x.unitName}${x.isHub ? ' (Hub)' : ''} · ${fmtDate.format(x.publishAt)}`,
		snippet: x.snippet
	}));
	out.faqs = faqs.map((x) => ({
		kind: 'faqs',
		id: x.id,
		title: x.question,
		href: `/faqs?einheit=${x.unitId}#faq-${x.id}`,
		meta: x.unitName,
		snippet: x.snippet
	}));
	out.termine = termine.map((x) => ({
		kind: 'termine',
		id: x.id,
		title: x.title,
		href: `/kalender/${x.id}`,
		meta: [day(x.date), x.allDay ? 'ganztägig' : x.startTime, x.place, x.unitName]
			.filter(Boolean)
			.join(' · ')
	}));
	if (want('hubs'))
		out.hubs = hubs
			.filter((h) => matchesSearch(text, [h.name, h.about]))
			.slice(0, limit)
			.map((h) => ({
				kind: 'hubs',
				id: h.id,
				title: h.name,
				href: `/hubs/${h.slug}`,
				meta: h.isCentral ? 'Hub für alle Mandanten' : `Hub · ${h.tenantShort}`
			}));
	out.brett = brett.map((x) => ({
		kind: 'brett',
		id: x.id,
		title: x.title,
		href: `/schwarzes-brett?q=${encodeURIComponent(x.title.slice(0, 100))}#anzeige-${x.id}`,
		meta: `${x.category} · ${fmtDate.format(x.createdAt)}`,
		snippet: x.snippet
	}));
	out.kulissen = kulissen.map((x) => ({
		kind: 'kulissen',
		id: x.id,
		title: x.title,
		href: `/hinter-den-kulissen/${x.id}`,
		meta: `${x.unitName} · ${fmtDate.format(x.publishAt)}`,
		snippet: x.snippet
	}));
	return out;
}
