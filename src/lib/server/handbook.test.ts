import { describe, expect, it } from 'vitest';
import { handbookAll, handbookArticle, handbookIndex } from './handbook.ts';
import type { Principal } from './auth/access.ts';

const person = (roles: string[] = []): Principal =>
	({
		personId: 'p',
		tenantId: 't',
		roles: roles.map((role) => ({ role, scope: 'all', scopeTenantId: null, scopeUnitId: null })),
		memberships: []
	}) as unknown as Principal;

describe('Handbuch-Artikel', () => {
	it('alle Artikel lassen sich lesen und haben Inhalt', () => {
		const all = handbookAll();
		expect(all.length).toBeGreaterThanOrEqual(20);
		for (const m of all) {
			const a = handbookArticle(m.slug)!;
			expect(a.html.length, m.slug).toBeGreaterThan(100);
			expect(a.html).not.toMatch(/<script|onerror=/i);
		}
		expect(new Set(all.map((m) => m.slug)).size).toBe(all.length);
	});

	it('filtert nach Rolle', () => {
		const ohne = handbookIndex(person(), false);
		const titel = ohne.chapters.flatMap((c) => c.articles.map((a) => a.slug));
		expect(titel).toContain('erste-schritte');
		expect(titel).not.toContain('moderation');
		expect(ohne.hidden).toBeGreaterThan(0);
		const mod = handbookIndex(person(['moderation_schwarzes_brett']), false);
		expect(mod.chapters.flatMap((c) => c.articles.map((a) => a.slug))).toContain('moderation');
		expect(handbookIndex(person(), true).hidden).toBe(0);
	});
});
