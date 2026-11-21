import { describe, expect, it } from 'vitest';
import { cleanLayout, DEFAULT_HUB_LAYOUT, parseTeam, validateApplication } from './hubs.ts';

describe('Hubs', () => {
	it('bereinigt den Seitenaufbau', () => {
		expect(cleanLayout(null)).toEqual(DEFAULT_HUB_LAYOUT);
		expect(
			cleanLayout({
				main: ['beitraege', 'quatsch', 'beitraege'] as never,
				side: ['beitraege', 'ueber']
			})
		).toEqual({ main: ['beitraege'], side: ['ueber'] });
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
		expect(linkAdresse('mailto:chor@oper.de')).toBe('mailto:chor@oper.de');
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
