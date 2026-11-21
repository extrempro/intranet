/**
 * Anmeldung in Teams per SSO (Teams-App): Teams gibt der App über
 * `authentication.getAuthToken()` ein Zugriffstoken der angemeldeten Person.
 * Hier wird es geprüft: Signatur (Schlüssel von Microsoft), Mandant (tid),
 * Empfänger (unsere App) und Scope `access_as_user`.
 *
 * Voraussetzung in der App-Registrierung („Expose an API“):
 * Application ID URI `api://<Host des Intranets>/<Client-ID>`, Scope
 * `access_as_user`, vorab berechtigt für Teams Desktop/Mobil
 * (1fec8e78-bce4-4aaf-ab1b-5451cc387264) und Teams im Browser
 * (5e3ce6c0-2b1f-4285-8d4b-75ee78787346).
 */
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { getEntraConfig, type EntraConfig } from './auth/entra.ts';

export const TEAMS_SCOPE = 'access_as_user';

/** Application ID URI der App für Teams-SSO */
export function teamsResource(origin: string, clientId: string): string {
	return `api://${new URL(origin).host}/${clientId}`;
}

let jwks: { tenant: string; set: ReturnType<typeof createRemoteJWKSet> } | null = null;

function keysFor(tenantId: string) {
	if (jwks?.tenant !== tenantId) {
		jwks = {
			tenant: tenantId,
			set: createRemoteJWKSet(
				new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
			)
		};
	}
	return jwks.set;
}

export interface TeamsIdentity {
	oid: string;
	tid: string;
	name: string;
	upn: string;
}

export class TeamsSsoError extends Error {}

/** Token prüfen; wirft TeamsSsoError mit verständlicher Meldung. */
export async function verifyTeamsToken(
	token: string,
	origin: string,
	/** Für Tests: eigene Einstellungen und Schlüssel */
	test?: { entra: Pick<EntraConfig, 'tenantId' | 'clientId'>; keys: JWTVerifyGetKey }
): Promise<TeamsIdentity> {
	const entra = test?.entra ?? (await getEntraConfig());
	if (!entra) throw new TeamsSsoError('Die Anmeldung mit Microsoft ist nicht eingerichtet.');
	const resource = teamsResource(origin, entra.clientId);
	let payload: JWTPayload;
	try {
		({ payload } = await jwtVerify(token, test?.keys ?? keysFor(entra.tenantId), {
			// v1-Token (Standard) und v2-Token, je nach Einstellung der App-Registrierung
			issuer: [
				`https://sts.windows.net/${entra.tenantId}/`,
				`https://login.microsoftonline.com/${entra.tenantId}/v2.0`
			],
			audience: [resource, entra.clientId],
			clockTolerance: 60
		}));
	} catch (err) {
		if (err instanceof errors.JWTClaimValidationFailed) {
			if (err.claim === 'aud')
				throw new TeamsSsoError(
					`Das Token ist für eine andere App ausgestellt. Erwartet: ${resource}`
				);
			if (err.claim === 'iss')
				throw new TeamsSsoError('Das Token stammt aus einem anderen Microsoft-Mandanten.');
			throw new TeamsSsoError(`Token ungültig (${err.claim}).`);
		}
		if (err instanceof errors.JWTExpired) throw new TeamsSsoError('Das Token ist abgelaufen.');
		if (err instanceof errors.JOSEError) throw new TeamsSsoError(`Token ungültig (${err.code}).`);
		throw new TeamsSsoError(
			'Die Schlüssel von Microsoft sind nicht erreichbar (login.microsoftonline.com).'
		);
	}
	const scopes = String(payload.scp ?? '').split(' ');
	if (!scopes.includes(TEAMS_SCOPE))
		throw new TeamsSsoError(`Dem Token fehlt der Scope ${TEAMS_SCOPE}.`);
	if (payload.tid !== entra.tenantId)
		throw new TeamsSsoError('Das Token stammt aus einem anderen Microsoft-Mandanten.');
	const oid = typeof payload.oid === 'string' ? payload.oid : '';
	if (!oid) throw new TeamsSsoError('Dem Token fehlt die Objekt-ID der Person.');
	return {
		oid,
		tid: String(payload.tid),
		name: String(payload.name ?? ''),
		upn: String(payload.preferred_username ?? payload.upn ?? '')
	};
}
