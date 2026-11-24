import { describe, expect, it } from 'vitest';
import {
	berlinToDate,
	dateToBerlinInput,
	effectiveTargets,
	lifecycle,
	newsState,
	validateNews,
	type NewsContext,
	type NewsDraft
} from './news';

describe('Berliner Zeit', () => {
	it('rechnet Winterzeit (UTC+1) um', () => {
		expect(berlinToDate('2026-11-20T08:00')?.toISOString()).toBe('2026-11-20T07:00:00.000Z');
	});
	it('rechnet Sommerzeit (UTC+2) um', () => {
		expect(berlinToDate('2026-07-01T08:00')?.toISOString()).toBe('2026-07-01T06:00:00.000Z');
	});
	it('geht hin und zurück', () => {
		expect(dateToBerlinInput(berlinToDate('2026-03-29T12:30')!)).toBe('2026-03-29T12:30');
	});
	it('lehnt Unsinn ab', () => {
		expect(berlinToDate('morgen')).toBeNull();
	});
});

const now = new Date('2026-11-20T10:00:00Z');
const H = 60 * 60 * 1000;
const ctx: NewsContext = {
	now,
	zielMandanten: null,
	unitTenantId: 't1',
	unitMayPostUrgent: true,
	pinMaxDays: 14,
	urgentMaxDays: 3,
	otherActiveUrgent: 0,
	urgentPerUnit: 1
};
const draft: NewsDraft = {
	title: 'Wartungsfenster',
	bodyText: 'Text',
	publishAt: now,
	expiresAt: null,
	pinnedUntil: null,
	urgentUntil: null,
	urgentText: null,
	allTenants: false,
	tenantIds: []
};

describe('validateNews', () => {
	it('nimmt einen einfachen Beitrag an', () => {
		expect(validateNews(draft, ctx)).toEqual({});
	});

	it('verlangt Titel und Text', () => {
		const e = validateNews({ ...draft, title: 'x', bodyText: ' ' }, ctx);
		expect(e.title).toBeDefined();
		expect(e.body).toBeDefined();
	});

	it('begrenzt Anheften auf 14 Tage', () => {
		expect(
			validateNews({ ...draft, pinnedUntil: new Date(now.getTime() + 14 * 24 * H) }, ctx)
		).toEqual({});
		expect(
			validateNews({ ...draft, pinnedUntil: new Date(now.getTime() + 15 * 24 * H) }, ctx)
				.pinnedUntil
		).toMatch(/14 Tage/);
	});

	it('verlangt bei dringend Enddatum, Bannertext und höchstens 3 Tage', () => {
		expect(validateNews({ ...draft, urgentText: 'Banner' }, ctx).urgentUntil).toMatch(/Pflicht/);
		expect(
			validateNews({ ...draft, urgentUntil: new Date(now.getTime() + 2 * H) }, ctx).urgentText
		).toBeDefined();
		expect(
			validateNews(
				{ ...draft, urgentUntil: new Date(now.getTime() + 4 * 24 * H), urgentText: 'B' },
				ctx
			).urgentUntil
		).toMatch(/3 Tage/);
	});

	it('erlaubt dringend nur mit Recht und nur eine je Einheit', () => {
		const ok = { ...draft, urgentUntil: new Date(now.getTime() + 2 * H), urgentText: 'B' };
		expect(validateNews(ok, ctx)).toEqual({});
		expect(validateNews(ok, { ...ctx, unitMayPostUrgent: false }).urgentUntil).toMatch(
			/keine dringenden/
		);
		expect(validateNews(ok, { ...ctx, otherActiveUrgent: 1 }).urgentUntil).toMatch(/schon/);
	});

	it('lässt den Ablauf nicht vor „Dringend bis“ liegen', () => {
		const e = validateNews(
			{
				...draft,
				urgentUntil: new Date(now.getTime() + 5 * H),
				urgentText: 'B',
				expiresAt: new Date(now.getTime() + 2 * H)
			},
			ctx
		);
		expect(e.expiresAt).toMatch(/Dringend/);
	});

	it('verlangt bei zentralen Absendern eine Zielgruppe', () => {
		expect(validateNews(draft, { ...ctx, zielMandanten: 'alle' }).tenants).toBeDefined();
		expect(validateNews({ ...draft, allTenants: true }, { ...ctx, zielMandanten: 'alle' })).toEqual(
			{}
		);
	});

	it('Redaktion je Mandant: nur die eigenen Mandanten, nicht „alle“', () => {
		const c = { ...ctx, zielMandanten: ['t1', 't2'] };
		expect(validateNews({ ...draft, allTenants: true }, c).tenants).toMatch(/alle Mandanten/);
		expect(validateNews({ ...draft, tenantIds: ['t1', 't3'] }, c).tenants).toMatch(/nicht/);
		expect(validateNews({ ...draft, tenantIds: ['t1', 't2'] }, c)).toEqual({});
	});
});

describe('effectiveTargets', () => {
	it('beschränkt nicht-zentrale Einheiten auf den eigenen Mandanten', () => {
		expect(
			effectiveTargets(
				{ allTenants: true, tenantIds: ['x'] },
				{ zielMandanten: null, unitTenantId: 't1' }
			)
		).toEqual({
			allTenants: false,
			tenantIds: ['t1']
		});
	});
	it('übernimmt bei zentralen Einheiten die Auswahl', () => {
		expect(
			effectiveTargets(
				{ allTenants: false, tenantIds: ['a', 'a', 'b'] },
				{ zielMandanten: 'alle', unitTenantId: 't1' }
			)
		).toEqual({
			allTenants: false,
			tenantIds: ['a', 'b']
		});
	});
});

describe('newsState und lifecycle', () => {
	it('erkennt geplant, dringend und „war dringend“', () => {
		const base = {
			publishAt: now,
			expiresAt: null,
			pinnedUntil: null,
			urgentUntil: new Date(now.getTime() + H)
		};
		expect(newsState(base, now).urgent).toBe(true);
		expect(newsState(base, new Date(now.getTime() + 2 * H)).wasUrgent).toBe(true);
		expect(newsState({ ...base, publishAt: new Date(now.getTime() + H) }, now).planned).toBe(true);
	});

	it('beschreibt den Ablauf', () => {
		const s = lifecycle({ publishAt: now, urgentUntil: new Date(now.getTime() + H) }, now);
		expect(s[0]).toMatch(/sofort/);
		expect(s.some((x) => x.includes('rotes Banner'))).toBe(true);
		expect(s.at(-1)).toMatch(/dauerhaft/);
	});
});
