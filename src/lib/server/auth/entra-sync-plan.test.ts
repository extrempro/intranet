import { describe, expect, it } from 'vitest';
import {
	planPerson,
	rolleSchluessel,
	zuVieleSperren,
	type SyncAction,
	type SyncContext,
	type SyncPerson
} from './entra-sync-plan.ts';

const ZUGANG = '11111111-1111-1111-1111-111111111111';
const REDAKTION = '22222222-2222-2222-2222-222222222222';
const T1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const T2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const ctx: SyncContext = {
	accessGroupId: ZUGANG,
	domains: { 'haus-a.test': T1, 'zweithaus.test': T2 },
	mappings: [
		{ groupId: REDAKTION, role: 'redaktion', scope: 'tenant', scopeTenantId: T1, scopeUnitId: null }
	]
};

const person = (x: Partial<SyncPerson> = {}): SyncPerson => ({
	id: 'p1',
	oid: 'o1',
	email: 'kai@haus-a.test',
	displayName: 'Kai Krüger',
	tenantId: T1,
	status: 'active',
	disabledBy: null,
	entraRoles: [],
	...x
});
const user = (x: Record<string, unknown> = {}) => ({
	id: 'o1',
	displayName: 'Kai Krüger',
	mail: 'kai@haus-a.test',
	userPrincipalName: 'kai@haus-a.test',
	accountEnabled: true,
	...x
});

describe('Entra-Abgleich je Person', () => {
	it('unverändert', () => {
		const a = planPerson(person(), { user: user(), groupIds: [ZUGANG] }, ctx);
		expect(a).toMatchObject({ art: 'abgleichen', geaendert: false, rollenGeaendert: false });
	});
	it('Name, Mandant und Rollen ändern sich', () => {
		const a = planPerson(
			person(),
			{
				user: user({ displayName: 'Kai K.', mail: 'kai@zweithaus.test' }),
				groupIds: [ZUGANG, REDAKTION]
			},
			ctx
		);
		expect(a).toMatchObject({
			art: 'abgleichen',
			geaendert: true,
			rollenGeaendert: true,
			tenantId: T2,
			displayName: 'Kai K.'
		});
	});
	it('Rolle fällt weg', () => {
		const alt = rolleSchluessel(ctx.mappings[0]);
		const a = planPerson(person({ entraRoles: [alt] }), { user: user(), groupIds: [ZUGANG] }, ctx);
		expect(a).toMatchObject({ art: 'abgleichen', rollenGeaendert: true, roles: [] });
	});
	it('sperrt bei gelöscht, deaktiviert, ohne Zugangsgruppe', () => {
		expect(planPerson(person(), null, ctx)).toMatchObject({ art: 'sperren', grund: 'geloescht' });
		expect(
			planPerson(person(), { user: user({ accountEnabled: false }), groupIds: [ZUGANG] }, ctx)
		).toMatchObject({ art: 'sperren', grund: 'account_disabled' });
		expect(planPerson(person(), { user: user(), groupIds: [] }, ctx)).toMatchObject({
			art: 'sperren',
			grund: 'not_in_access_group'
		});
	});
	it('gibt von Entra gesperrte Konten wieder frei, sonst bleiben sie gesperrt', () => {
		const gesperrt = person({ status: 'disabled', disabledBy: 'entra' });
		expect(planPerson(gesperrt, { user: user(), groupIds: [ZUGANG] }, ctx)).toMatchObject({
			art: 'abgleichen',
			freigeben: true
		});
		expect(planPerson(gesperrt, { user: user(), groupIds: [] }, ctx).art).toBe('bleibt_gesperrt');
		expect(planPerson(gesperrt, null, ctx).art).toBe('bleibt_gesperrt');
	});
});

describe('Schutz vor zu vielen Sperren', () => {
	const sperren = (n: number, aktiv: number): SyncAction[] => [
		...Array.from({ length: n }, () => ({
			art: 'sperren' as const,
			person: person(),
			grund: 'geloescht' as const
		})),
		...Array.from({ length: aktiv - n }, () => ({
			art: 'bleibt_gesperrt' as const,
			person: person()
		}))
	];
	it('5 Sperren gehen immer, mehr als 10 % ab 6 nicht', () => {
		expect(zuVieleSperren(sperren(5, 10))).toBeNull();
		expect(zuVieleSperren(sperren(6, 100))).toBeNull();
		expect(zuVieleSperren(sperren(11, 100))).toEqual({ sperren: 11, aktiv: 100 });
	});
});
