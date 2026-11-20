import { describe, expect, it } from 'vitest';
import { digestModesDue, resolveNotify } from './notify.ts';

describe('Benachrichtigungen', () => {
	it('füllt Voreinstellungen nach Tabelle 11.2 auf', () => {
		const r = resolveNotify(null);
		expect(r.emailMode).toBe('taeglich');
		expect(r.topics.dringend).toEqual({ bell: true, email: true });
		expect(r.topics.angeheftet).toEqual({ bell: true, email: false });
		expect(r.topics.speiseplan).toEqual({ bell: false, email: false });
	});

	it('übernimmt eigene Einstellungen, aber nie „Glocke aus“ bei dringenden Meldungen', () => {
		const r = resolveNotify({
			topics: { dringend: { bell: false, email: false }, neuigkeiten: { email: false } },
			emailMode: 'sofort'
		});
		expect(r.topics.dringend).toEqual({ bell: true, email: false });
		expect(r.topics.neuigkeiten).toEqual({ bell: true, email: false });
		expect(r.emailMode).toBe('sofort');
		expect(resolveNotify({ topics: {}, emailMode: 'quatsch' as never }).emailMode).toBe('taeglich');
	});

	it('verschickt Zusammenfassungen einmal am Tag ab 7 Uhr', () => {
		const fr = { date: '2026-11-20', weekday: 4, time: '07:00' };
		expect(digestModesDue({ ...fr, time: '06:59' }, null)).toEqual([]);
		expect(digestModesDue(fr, null)).toEqual(['taeglich']);
		expect(digestModesDue(fr, '2026-11-20')).toEqual([]);
		expect(digestModesDue({ date: '2026-11-23', weekday: 0, time: '09:15' }, '2026-11-20')).toEqual(
			['taeglich', 'woechentlich']
		);
	});
});
