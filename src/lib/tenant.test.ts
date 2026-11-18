import { describe, expect, it } from 'vitest';
import { tenantFromEmail } from './tenant';

const domains = { 'haupt.example': 'haupt', 'mandant-b.example': 'b' };

describe('tenantFromEmail', () => {
	it('findet den Mandanten über die Domain', () => {
		expect(tenantFromEmail('max@haupt.example', domains)).toBe('haupt');
	});

	it('ignoriert Groß- und Kleinschreibung und Leerzeichen', () => {
		expect(tenantFromEmail('  Max@Mandant-B.Example ', domains)).toBe('b');
	});

	it('gibt null zurück, wenn keine Domain passt', () => {
		expect(tenantFromEmail('max@fremd.example', domains)).toBeNull();
	});

	it('gibt null zurück bei ungültigen Adressen', () => {
		expect(tenantFromEmail('kein-at', domains)).toBeNull();
		expect(tenantFromEmail('@haupt.example', domains)).toBeNull();
		expect(tenantFromEmail('max@', domains)).toBeNull();
	});

	it('fällt nicht auf Eigenschaften des Objekt-Prototyps herein', () => {
		expect(tenantFromEmail('max@constructor', domains)).toBeNull();
	});
});
