import { describe, expect, it } from 'vitest';
import { limiter } from './rate-limit.ts';

describe('Begrenzung von Anfragen', () => {
	it('lässt max Anfragen im Fenster zu und gibt danach wieder frei', () => {
		const l = limiter(3, 1000);
		expect([l.hit('a', 0), l.hit('a', 10), l.hit('a', 20), l.hit('a', 30)]).toEqual([
			true,
			true,
			true,
			false
		]);
		expect(l.hit('b', 30)).toBe(true);
		expect(l.retryAfter('a', 30)).toBe(1);
		expect(l.hit('a', 1001)).toBe(true);
		expect(l.retryAfter('c', 0)).toBe(0);
	});
});
