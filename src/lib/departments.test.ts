import { describe, expect, it } from 'vitest';
import {
	groupResponsibilities,
	isReviewOverdue,
	isSafeUrl,
	linksToText,
	matchesSearch,
	parseKeywords,
	parseLinks,
	validateResponsibility
} from './departments.ts';

const P = '11111111-1111-4111-8111-111111111111';
const D = '22222222-2222-4222-8222-222222222222';
const base = {
	topic: 'Drucker',
	description: '',
	keywords: '',
	groupName: '',
	personId: P,
	deputyId: '',
	links: ''
};

describe('Zuständigkeiten', () => {
	it('liest Stichwörter ohne Doppelte', () => {
		expect(parseKeywords('Drucker, Toner;drucker\n Scanner ')).toEqual([
			'Drucker',
			'Toner',
			'Scanner'
		]);
	});

	it('liest Links und lehnt gefährliche Adressen ab', () => {
		expect(parseLinks('Anleitung | https://wiki.example/drucker\n/faqs')).toEqual({
			links: [
				{ label: 'Anleitung', url: 'https://wiki.example/drucker' },
				{ label: '/faqs', url: '/faqs' }
			]
		});
		expect(parseLinks('Böse | javascript:alert(1)').error).toBeTruthy();
		expect(isSafeUrl('//fremd.example')).toBe(false);
		expect(isSafeUrl('data:text/html,x')).toBe(false);
		expect(
			linksToText([
				{ label: 'A', url: 'https://a.example' },
				{ label: '/x', url: '/x' }
			])
		).toBe('A | https://a.example\n/x');
	});

	it('prüft Pflichtfelder und Vertretung', () => {
		expect(validateResponsibility({ ...base, topic: 'x' }).errors.topic).toBeTruthy();
		expect(validateResponsibility({ ...base, personId: '' }).errors.personId).toBeTruthy();
		expect(validateResponsibility({ ...base, deputyId: P }).errors.deputyId).toBeTruthy();
		const ok = validateResponsibility({
			...base,
			deputyId: D,
			keywords: 'a, b',
			groupName: ' IT '
		});
		expect(ok.value).toMatchObject({ deputyId: D, keywords: ['a', 'b'], groupName: 'IT' });
	});

	it('sucht ohne Rücksicht auf Groß- und Kleinschreibung und Umlaute', () => {
		expect(matchesSearch('strasse buro', ['Straßenplan', 'Büro'])).toBe(true);
		expect(matchesSearch('drucker fax', ['Drucker'])).toBe(false);
		expect(matchesSearch('  ', ['egal'])).toBe(true);
	});

	it('gruppiert, ohne Gruppe zuerst', () => {
		const g = groupResponsibilities([
			{ groupName: 'B', id: 1 },
			{ groupName: null, id: 2 },
			{ groupName: 'B', id: 3 }
		]);
		expect(g.map((x) => [x.group, x.items.map((i) => i.id)])).toEqual([
			[null, [2]],
			['B', [1, 3]]
		]);
	});

	it('erinnert nach der eingestellten Zahl Monate', () => {
		const now = new Date('2026-11-20T10:00:00Z');
		expect(isReviewOverdue(new Date('2025-11-19T10:00:00Z'), 12, now)).toBe(true);
		expect(isReviewOverdue(new Date('2026-01-01T10:00:00Z'), 12, now)).toBe(false);
		expect(isReviewOverdue(null, 12, now)).toBe(false);
	});
});
