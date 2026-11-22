import { describe, expect, it } from 'vitest';
import { cleanLayout, DEFAULT_HUB_LAYOUT, parseTeam, validateApplication } from './hubs.ts';

describe('Hubs', () => {
	it('bereinigt den Seitenaufbau', () => {
		expect(cleanLayout(null)).toEqual(DEFAULT_HUB_LAYOUT);
		expect(
			cleanLayout({
				reiter: ['fragen', 'quatsch', 'fragen', 'neues'],
				ueberblick: ['beitraege', 'quatsch', 'beitraege', 'faqs']
			})
		).toEqual({
			reiter: ['fragen', 'neues', 'termine', 'dokumente', 'videos', 'team'],
			ueberblick: ['beitraege', 'faqs']
		});
	});

	it('übernimmt ältere Aufbauten mit Haupt- und Seitenbereich', () => {
		expect(
			cleanLayout({ main: ['schnellzugriff', 'beitraege', 'dokumente'], side: ['faqs', 'ueber'] })
		).toEqual({
			reiter: DEFAULT_HUB_LAYOUT.reiter,
			ueberblick: ['schnellzugriff', 'faqs', 'beitraege']
		});
	});

	it('liest das Hub-Team aus Freitext', () => {
		expect(parseTeam('a@x.de, B@x.de\nc@x.de; a@x.de')).toEqual(['a@x.de', 'b@x.de', 'c@x.de']);
	});

	it('prüft Anträge', () => {
		const ok = {
			name: 'Radfahrende',
			description: 'Austausch rund ums Rad.',
			reason: 'Viele fahren mit dem Rad.',
			team: 'a@x.de',
			central: false
		};
		expect(validateApplication(ok)).toEqual({});
		expect(validateApplication({ ...ok, team: 'keine mail' }).team).toBeTruthy();
		expect(validateApplication({ ...ok, name: 'R' }).name).toBeTruthy();
	});
});

describe('Schnellzugriff-Adressen', () => {
	it('erlaubt https, mailto, tel und Pfade im Intranet', async () => {
		const { linkAdresse } = await import('./hubs.ts');
		expect(linkAdresse('example.org/plan')).toBe('https://example.org/plan');
		expect(linkAdresse('https://teams.microsoft.com/l/x')).toBe('https://teams.microsoft.com/l/x');
		expect(linkAdresse('/faqs?einheit=1')).toBe('/faqs?einheit=1');
		expect(linkAdresse('mailto:chor@example.org')).toBe('mailto:chor@example.org');
		expect(linkAdresse('tel:+4940123')).toBe('tel:+4940123');
	});
	it('lehnt gefährliche oder fremde Adressen ab', async () => {
		const { linkAdresse } = await import('./hubs.ts');
		for (const a of [
			'javascript:alert(1)',
			'data:text/html,x',
			'//boese.example',
			'/\\boese',
			'ftp://x',
			'https://a b',
			''
		])
			expect(linkAdresse(a)).toBeNull();
	});
});

describe('Reiter der Hub-Seite', () => {
	it('zeigt leere Reiter nur denen, die sie füllen dürfen', async () => {
		const { hubReiter, DEFAULT_HUB_LAYOUT } = await import('./hubs.ts');
		const q = {
			hatNeues: true,
			termine: 2,
			dokumente: 0,
			videos: 0,
			fragen: 3,
			team: 1,
			resting: false,
			canPost: false,
			canDocs: true,
			canFaqs: false,
			canManage: false,
			canVideos: false
		};
		const r = hubReiter(DEFAULT_HUB_LAYOUT, q);
		expect(r.map((x) => x.key)).toEqual(DEFAULT_HUB_LAYOUT.reiter);
		expect(r.find((x) => x.key === 'termine')).toMatchObject({ anzahl: 2, leer: false });
		expect(r.find((x) => x.key === 'dokumente')).toMatchObject({ leer: true, pflegbar: true });
		expect(r.find((x) => x.key === 'videos')).toMatchObject({ leer: true, pflegbar: false });
		expect(r.find((x) => x.key === 'neues')?.anzahl).toBeNull();
	});
});
