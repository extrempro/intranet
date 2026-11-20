import { describe, expect, it } from 'vitest';
import { ipPrefix } from './net';

describe('ipPrefix', () => {
	it('kürzt IPv4 auf /24', () => {
		expect(ipPrefix('192.0.2.123')).toBe('192.0.2.0/24');
	});

	it('kürzt verpackte IPv4-Adressen', () => {
		expect(ipPrefix('::ffff:198.51.100.7')).toBe('198.51.100.0/24');
	});

	it('kürzt IPv6 auf /48', () => {
		expect(ipPrefix('2001:db8:abcd:12::1')).toBe('2001:db8:abcd::/48');
		expect(ipPrefix('2001:0DB8::1')).toBe('2001:db8:0::/48');
	});

	it('gibt bei Unsinn null zurück', () => {
		expect(ipPrefix('')).toBeNull();
		expect(ipPrefix(undefined)).toBeNull();
		expect(ipPrefix('kein-ip')).toBeNull();
	});
});
