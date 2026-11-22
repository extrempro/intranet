import { describe, expect, it } from 'vitest';
import { bucketFehler, endpointFehler } from './speicher.ts';

describe('endpointFehler', () => {
	it('nur https mit Namen, ohne Pfad, Zugangsdaten oder interne Namen', () => {
		expect(endpointFehler('https://s3.example.org')).toBeNull();
		expect(endpointFehler('https://s3.example.org/')).toBeNull();
		for (const e of [
			'http://s3.example.org',
			'https://10.0.0.1',
			'https://[::1]',
			'https://localhost',
			'https://nas.local',
			'https://s3.example.org/bucket',
			'https://a:b@s3.example.org',
			'https://s3.example.org?x=1',
			'kein-url'
		])
			expect(endpointFehler(e), e).not.toBeNull();
	});
});

describe('bucketFehler', () => {
	it('prüft die S3-Regeln', () => {
		expect(bucketFehler('intranet-medien')).toBeNull();
		for (const b of ['ab', 'Gross', 'a..b', '-start', 'x'.repeat(64)])
			expect(bucketFehler(b), b).not.toBeNull();
	});
});
