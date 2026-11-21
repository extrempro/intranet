import { describe, expect, it } from 'vitest';
import { neuerungsHinweis } from './neue-version.ts';

describe('neuerungsHinweis', () => {
	it('zeigt nach einem Update einmal den Hinweis', () => {
		expect(neuerungsHinweis({ gesehen: '0.10.1', an: true }, '0.11.0', '/')).toEqual({
			merken: true,
			zeigen: true
		});
	});
	it('nichts, wenn die Version schon gesehen ist', () => {
		expect(neuerungsHinweis({ gesehen: '0.11.0', an: true }, '0.11.0', '/')).toEqual({
			merken: false,
			zeigen: false
		});
	});
	it('erster Besuch: nur merken', () => {
		expect(neuerungsHinweis({ gesehen: null, an: true }, '0.11.0', '/')).toEqual({
			merken: true,
			zeigen: false
		});
	});
	it('ausgeschaltet: nur merken', () => {
		expect(neuerungsHinweis({ gesehen: '0.10.1', an: false }, '0.11.0', '/')).toEqual({
			merken: true,
			zeigen: false
		});
	});
	it('„Neu im Intranet“ geöffnet: merken ohne Hinweis', () => {
		expect(neuerungsHinweis({ gesehen: '0.10.1', an: true }, '0.11.0', '/neu-im-intranet')).toEqual(
			{ merken: true, zeigen: false }
		);
	});
});
