/** Einstellung „teams“ (Verwaltung → Benachrichtigungen). Eigene Datei gegen Import-Kreise. */
import { randomUUID } from 'node:crypto';
import { getEntraConfig } from './auth/entra.ts';
import { getSetting, setSetting } from './settings.ts';

export interface TeamsSettings {
	aktiv: boolean;
	/** id im Teams-App-Manifest (fest, sonst gilt die App als neue App) */
	appId: string;
	/** Version des App-Pakets; steigt bei jedem neuen Paket */
	version: number;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * App-ID aus der .env (TEAMS_APP_ID). Festgelegt bleibt sie auch bei einer neuen
 * Datenbank gleich, sonst bekäme die Teams-App eine neue ID („App nicht gefunden“).
 */
export function teamsAppIdAusEnv(): string | null {
	const v = process.env.TEAMS_APP_ID?.trim().toLowerCase();
	return v && GUID.test(v) ? v : null;
}

export async function teamsSettings(): Promise<TeamsSettings> {
	const fest = teamsAppIdAusEnv();
	const s = await getSetting<Partial<TeamsSettings> | null>('teams', null);
	if (s?.appId) return { aktiv: s.aktiv === true, appId: fest ?? s.appId, version: s.version ?? 1 };
	// Beim ersten Aufruf die App-ID festhalten (aus der .env oder neu)
	const neu: TeamsSettings = { aktiv: false, appId: fest ?? randomUUID(), version: 1 };
	await setSetting('teams', neu, null);
	return neu;
}

export async function saveTeamsSettings(s: TeamsSettings, by: string) {
	await setSetting('teams', s, by);
}

/** Teams-Benachrichtigungen eingeschaltet und Entra eingerichtet? */
export async function teamsActive(): Promise<boolean> {
	const s = await getSetting<Partial<TeamsSettings> | null>('teams', null);
	return Boolean(s?.aktiv && (await getEntraConfig()));
}
