import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { teamsResource, TeamsSsoError, verifyTeamsToken } from './teams-sso.ts';

const TID = '11111111-1111-1111-1111-111111111111';
const CID = '22222222-2222-2222-2222-222222222222';
const ORIGIN = 'https://intranet.example';
const entra = { tenantId: TID, clientId: CID };
const TEAMS_DESKTOP = '1fec8e78-bce4-4aaf-ab1b-5451cc387264';

let keys: ReturnType<typeof createLocalJWKSet>;
let privat: CryptoKey;

beforeAll(async () => {
	const paar = await generateKeyPair('RS256');
	privat = paar.privateKey;
	const jwk = { ...(await exportJWK(paar.publicKey)), kid: 'k1', alg: 'RS256' };
	keys = createLocalJWKSet({ keys: [jwk] });
});

function token(claims: Record<string, unknown>, opt: { iss?: string; aud?: string } = {}) {
	return new SignJWT({
		tid: TID,
		oid: 'o-1',
		scp: 'access_as_user',
		name: 'Ada',
		appid: TEAMS_DESKTOP,
		...claims
	})
		.setProtectedHeader({ alg: 'RS256', kid: 'k1' })
		.setIssuer(opt.iss ?? `https://sts.windows.net/${TID}/`)
		.setAudience(opt.aud ?? teamsResource(ORIGIN, CID))
		.setIssuedAt()
		.setExpirationTime('10m')
		.sign(privat);
}

describe('Teams-SSO', () => {
	it('baut die Application ID URI aus Host und Client-ID', () => {
		expect(teamsResource('https://intranet.example:8443/x', CID)).toBe(
			`api://intranet.example:8443/${CID}`
		);
	});

	it('nimmt ein gültiges v1-Token an', async () => {
		const id = await verifyTeamsToken(await token({}), ORIGIN, { entra, keys });
		expect(id).toMatchObject({ oid: 'o-1', tid: TID, name: 'Ada' });
	});

	it('nimmt ein gültiges v2-Token an (Empfänger = Client-ID)', async () => {
		const t = await token(
			{ appid: undefined, azp: '5e3ce6c0-2b1f-4285-8d4b-75ee78787346' },
			{ iss: `https://login.microsoftonline.com/${TID}/v2.0`, aud: CID }
		);
		await expect(verifyTeamsToken(t, ORIGIN, { entra, keys })).resolves.toBeTruthy();
	});

	it('lehnt Tokens ab, die kein Teams-, Outlook- oder M365-Client angefordert hat', async () => {
		const fremderClient = await token({ appid: '33333333-3333-3333-3333-333333333333' });
		await expect(verifyTeamsToken(fremderClient, ORIGIN, { entra, keys })).rejects.toThrow(
			/nicht von Teams/
		);
		const ohneClient = await token({ appid: undefined });
		await expect(verifyTeamsToken(ohneClient, ORIGIN, { entra, keys })).rejects.toThrow(
			/nicht von Teams/
		);
	});

	it('lehnt fremde App, fremden Mandanten und fehlenden Scope ab', async () => {
		const fremdeApp = await token({}, { aud: 'api://andere/app' });
		await expect(verifyTeamsToken(fremdeApp, ORIGIN, { entra, keys })).rejects.toThrow(
			/andere App/
		);
		const fremderMandant = await token({}, { iss: 'https://sts.windows.net/x/' });
		await expect(verifyTeamsToken(fremderMandant, ORIGIN, { entra, keys })).rejects.toThrow(
			TeamsSsoError
		);
		const ohneScope = await token({ scp: 'User.Read' });
		await expect(verifyTeamsToken(ohneScope, ORIGIN, { entra, keys })).rejects.toThrow(
			/access_as_user/
		);
	});

	it('lehnt ein Token mit falscher Signatur ab', async () => {
		const t = await token({});
		const kaputt = t.slice(0, -4) + (t.endsWith('AAAA') ? 'BBBB' : 'AAAA');
		await expect(verifyTeamsToken(kaputt, ORIGIN, { entra, keys })).rejects.toThrow(TeamsSsoError);
	});
});
