import { describe, expect, it } from 'vitest';
import { istOeffentlich, sichererLookup } from './sicheres-netz.ts';

describe('istOeffentlich', () => {
	it('lehnt interne und besondere Netze ab', () => {
		for (const ip of [
			'127.0.0.1',
			'10.1.2.3',
			'172.16.0.1',
			'172.31.255.255',
			'192.168.1.1',
			'100.64.0.10',
			'169.254.169.254',
			'0.0.0.0',
			'::1',
			'::',
			'fe80::1',
			'fd00::1',
			'::ffff:127.0.0.1',
			'::ffff:10.0.0.1',
			'::ffff:7f00:1',
			// Nachprüfung 24.11.2026: Benchmark-Netz, eingebettete IPv4, site-local
			'198.18.0.1',
			'198.19.255.1',
			'192.88.99.1',
			'::127.0.0.1',
			'::ffff:0:7f00:1',
			'2002:7f00:1::1',
			'64:ff9b:1::a00:1',
			'fec0::1',
			'kein-ip'
		])
			expect(istOeffentlich(ip), ip).toBe(false);
	});
	it('lässt öffentliche Adressen zu', () => {
		for (const ip of [
			'1.1.1.1',
			'8.8.8.8',
			'172.32.0.1',
			'198.16.0.1',
			'2a01:4f8::1',
			'2001:4860::8888',
			'::ffff:1.1.1.1'
		])
			expect(istOeffentlich(ip), ip).toBe(true);
	});
});

describe('sichererLookup', () => {
	it('verweigert Namen, die auf interne Adressen zeigen', async () => {
		const err = await new Promise<NodeJS.ErrnoException | null>((ok) =>
			sichererLookup('localhost', {}, (e) => ok(e))
		);
		expect(err?.code).toBe('EINTERN');
	});
});
