import { describe, expect, it } from 'vitest';
import { auditDetails, auditLabel } from './audit-labels.ts';

describe('Protokoll', () => {
	it('übersetzt bekannte Aktionen und lässt unbekannte stehen', () => {
		expect(auditLabel('role.grant')).toBe('Rolle vergeben');
		expect(auditLabel('neu.etwas')).toBe('neu.etwas');
	});
	it('zeigt Details kompakt', () => {
		expect(
			auditDetails({
				pinMaxDays: { vorher: 14, nachher: 7 },
				hidden: true,
				x: null,
				list: ['a', 'b']
			})
		).toBe('pinMaxDays: 14 → 7 · hidden: ja · x: – · list: a b');
		expect(auditDetails(null)).toBe('');
	});
});
