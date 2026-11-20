import { describe, expect, it } from 'vitest';
import { appRolesFromToken, parseEntraForm } from './entra.ts';
import { allowResetRequest } from './reset.ts';

const jwt = (payload: object) =>
	`x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;

describe('Verwaltung → Anmeldung', () => {
	it('liest die Anwendungsberechtigungen aus dem Token', () => {
		expect(appRolesFromToken(jwt({ roles: ['User.Read.All', 'Mail.Send', 3] }))).toEqual([
			'User.Read.All',
			'Mail.Send'
		]);
		expect(appRolesFromToken(jwt({}))).toEqual([]);
		expect(appRolesFromToken('kaputt')).toEqual([]);
	});
	it('prüft die Entra-IDs; leer heißt: Wert aus der .env', () => {
		const r = parseEntraForm({
			tenantId: ' 3A000000-0000-0000-0000-000000000001 ',
			clientId: 'keine-guid',
			accessGroupId: ''
		});
		expect(r.werte).toEqual({ tenantId: '3a000000-0000-0000-0000-000000000001' });
		expect(Object.keys(r.fehler)).toEqual(['clientId']);
	});
	it('begrenzt Anfragen „Passwort vergessen“ je IP', () => {
		const t = 1_000_000;
		for (let i = 0; i < 10; i++) expect(allowResetRequest('203.0.113.9', t + i)).toBe(true);
		expect(allowResetRequest('203.0.113.9', t + 11)).toBe(false);
		expect(allowResetRequest('203.0.113.10', t + 11)).toBe(true);
		expect(allowResetRequest('203.0.113.9', t + 3_700_000)).toBe(true);
	});
});
