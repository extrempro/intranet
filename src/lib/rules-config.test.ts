import { describe, expect, it } from 'vitest';
import {
	DEFAULT_RULES,
	parseReactions,
	RETENTION_FIELDS,
	retentionValue,
	validateRules
} from './rules-config.ts';

function form(over: Record<string, string> = {}) {
	const f: Record<string, string> = {};
	for (const [k, v] of Object.entries(DEFAULT_RULES))
		if (typeof v === 'number') f[k] = String(v);
		else if (typeof v === 'boolean') {
			if (v) f[k] = 'on';
		} else f[k] = (v as string[]).join(' ');
	return { ...f, ...over };
}

describe('Regeln für Inhalte', () => {
	it('übernimmt gültige Werte', () => {
		const r = validateRules(form({ pinMaxDays: '7', reactions: '👍 🎉' }));
		expect(r.value?.pinMaxDays).toBe(7);
		expect(r.value?.reactions).toEqual(['👍', '🎉']);
		expect(validateRules(form()).value).toEqual(DEFAULT_RULES);
	});

	it('lehnt Werte außerhalb der Grenzen ab', () => {
		expect(validateRules(form({ pinMaxDays: '0' })).errors.pinMaxDays).toBeTruthy();
		expect(validateRules(form({ writersMax: '2.5' })).errors.writersMax).toBeTruthy();
		expect(validateRules(form({ reactions: '<b>' })).errors.reactions).toBeTruthy();
	});

	it('ein Kästchen ohne Haken heißt aus', () => {
		const f = form();
		delete f.eventsHubs;
		expect(validateRules(f).value?.eventsHubs).toBe(false);
	});

	it('erkennt Emojis mit Varianten und Hauttönen', () => {
		expect(parseReactions('❤️ 👍🏽 👩‍💻')).toEqual(['❤️', '👍🏽', '👩‍💻']);
		expect(parseReactions('a')).toBeNull();
		expect(parseReactions('')).toBeNull();
		expect(parseReactions('👍 🎉 😀 😁 😂 🤣 😃 😄 😅')).toBeNull();
	});
});

describe('Löschfristen', () => {
	it('nimmt nur erlaubte Optionen, sonst den Standard', () => {
		const board = RETENTION_FIELDS.find((f) => f.key === 'board_days')!;
		expect(retentionValue(board, 0)).toBe(0);
		expect(retentionValue(board, 14)).toBe(14);
		expect(retentionValue(board, 15)).toBe(30);
		expect(retentionValue(board, 'x')).toBe(30);
	});
});
