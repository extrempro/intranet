import { describe, expect, it } from 'vitest';
import { resolveEntraLogin, type EntraLoginInput } from './entra-login';

const base: EntraLoginInput = {
	email: 'Max.Muster@Beispielhaus.de',
	groupIds: ['zugang'],
	accountEnabled: true,
	accessGroupId: 'zugang',
	domains: { 'beispielhaus.de': 'm-haupt', 'zweithaus.de': 'm-b' },
	mappings: [
		{
			groupId: 'redaktion',
			role: 'redaktion',
			scope: 'all',
			scopeTenantId: null,
			scopeUnitId: null
		},
		{
			groupId: 'redaktion-b',
			role: 'redaktion',
			scope: 'tenant',
			scopeTenantId: 'm-b',
			scopeUnitId: null
		}
	]
};

describe('resolveEntraLogin', () => {
	it('leitet den Mandanten aus der Domain ab', () => {
		const r = resolveEntraLogin(base);
		expect(r).toEqual({
			ok: true,
			tenantId: 'm-haupt',
			email: 'Max.Muster@Beispielhaus.de',
			roles: []
		});
	});

	it('lehnt ohne Zugangsgruppe ab', () => {
		expect(resolveEntraLogin({ ...base, groupIds: ['andere'] })).toEqual({
			ok: false,
			reason: 'not_in_access_group'
		});
	});

	it('lehnt unbekannte Domains ab', () => {
		expect(resolveEntraLogin({ ...base, email: 'a@extern.de' })).toEqual({
			ok: false,
			reason: 'unknown_domain'
		});
	});

	it('lehnt gesperrte Konten ab, auch mit Zugang', () => {
		expect(resolveEntraLogin({ ...base, accountEnabled: false })).toEqual({
			ok: false,
			reason: 'account_disabled'
		});
	});

	it('lehnt ohne E-Mail ab', () => {
		expect(resolveEntraLogin({ ...base, email: '' })).toEqual({ ok: false, reason: 'no_email' });
	});

	it('meldet fehlende Einrichtung', () => {
		expect(resolveEntraLogin({ ...base, accessGroupId: null })).toEqual({
			ok: false,
			reason: 'not_configured'
		});
	});

	it('übernimmt Rollen aus Gruppen und entfernt Doppelte', () => {
		const r = resolveEntraLogin({
			...base,
			groupIds: ['zugang', 'redaktion', 'redaktion-b'],
			mappings: [...base.mappings, { ...base.mappings[0], groupId: 'redaktion' }]
		});
		expect(r.ok && r.roles.map((x) => `${x.role}:${x.scope}:${x.scopeTenantId}`)).toEqual([
			'redaktion:all:null',
			'redaktion:tenant:m-b'
		]);
	});

	it('vergibt keine Rolle System-Admin von selbst (nur über Zuordnungen)', () => {
		const r = resolveEntraLogin({ ...base, groupIds: ['zugang', 'admins'] });
		expect(r.ok && r.roles).toEqual([]);
	});
});
