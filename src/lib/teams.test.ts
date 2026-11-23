import { describe, expect, it } from 'vitest';
import { resolveNotify } from './notify.ts';
import { activityBody, activityFor, safeTabTarget, teamsDeepLink } from './teams.ts';
import { crc32, zip } from './server/zip.ts';
import { pageIcon } from './server/png.ts';

const APP = '11111111-2222-3333-4444-555555555555';

describe('Teams', () => {
	it('Deep Link auf den Tab mit dem Pfad als subEntityId', () => {
		const url = new URL(teamsDeepLink(APP, '/neuigkeiten/abc'));
		expect(url.origin).toBe('https://teams.microsoft.com');
		expect(url.pathname).toBe(`/l/entity/${APP}/intranet`);
		expect(JSON.parse(url.searchParams.get('context')!)).toEqual({
			subEntityId: '/neuigkeiten/abc'
		});
	});

	it('nur eigene Pfade als Ziel', () => {
		expect(safeTabTarget('/neuigkeiten/1')).toBe('/neuigkeiten/1');
		for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', '', null])
			expect(safeTabTarget(bad)).toBe('/');
	});

	it('eine Meldung: Titel und Absender; mehrere: zusammengefasst', () => {
		expect(activityFor([{ title: 'WLAN aus', detail: 'IT', link: '/neuigkeiten/1' }])).toEqual({
			preview: 'WLAN aus',
			text: 'IT: WLAN aus',
			link: '/neuigkeiten/1'
		});
		const sammel = activityFor([
			{ title: 'A', detail: null, link: '/a' },
			{ title: 'B', detail: null, link: '/b' }
		]);
		expect(sammel).toMatchObject({ preview: '2 neue Meldungen im Intranet', link: '/' });
	});

	it('Aufbau für Graph', () => {
		const body = activityBody(APP, activityFor([{ title: 'T', detail: 'IT', link: '/x' }]), [
			'o1',
			'o2'
		]);
		expect(body).toMatchObject({
			activityType: 'systemDefault',
			topic: { source: 'text', value: 'Intranet' },
			previewText: { content: 'T' },
			templateParameters: [{ name: 'systemDefaultText', value: 'IT: T' }]
		});
		expect(body.topic.webUrl.startsWith('https://teams.microsoft.com/')).toBe(true);
		// Aus dem Aktivitätsfeed nur der Hinweis, nicht das ganze Intranet
		const ctx = new URL(body.topic.webUrl).searchParams.get('context')!;
		expect(JSON.parse(ctx)).toEqual({ subEntityId: 'hinweis:/x' });
		expect(body.recipients).toHaveLength(2);
	});

	it('Voreinstellungen: Teams wie Push, für alle Themen wählbar', () => {
		const t = resolveNotify(null).topics;
		expect([
			t.dringend.teams,
			t.angeheftet.teams,
			t.neuigkeiten.teams,
			t.nachrichten.teams
		]).toEqual([true, true, false, true]);
		const s = resolveNotify({
			topics: { neuigkeiten: { teams: true }, angeheftet: { teams: false } },
			emailMode: 'sofort'
		});
		expect([s.topics.neuigkeiten.teams, s.topics.angeheftet.teams]).toEqual([true, false]);
	});

	it('App-Paket: gültige Prüfsummen, PNG und ZIP', () => {
		expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
		const icon = pageIcon(32, [255, 255, 255, 255], [0, 0, 0, 0]);
		expect([...icon.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		const z = zip([{ name: 'a.txt', data: new TextEncoder().encode('hallo') }]);
		expect(Buffer.from(z.slice(0, 4)).readUInt32LE(0)).toBe(0x04034b50);
	});

	it('Fehlertexte', async () => {
		const { teamsFehlertext } = await import('./server/teams.ts');
		expect(teamsFehlertext(new TypeError('fetch failed'))).toContain('nicht erreichbar');
		expect(teamsFehlertext(new Error('AADSTS7000215: Invalid client secret'))).toContain('Secret');
		const { GraphError } = await import('./server/auth/entra.ts');
		expect(teamsFehlertext(new GraphError(412, 'PreconditionFailed'))).toContain('zu kurz gültig');
	});
});
