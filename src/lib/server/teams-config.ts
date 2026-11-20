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

export async function teamsSettings(): Promise<TeamsSettings> {
	const s = await getSetting<Partial<TeamsSettings> | null>('teams', null);
	if (s?.appId) return { aktiv: s.aktiv === true, appId: s.appId, version: s.version ?? 1 };
	// Beim ersten Aufruf eine feste App-ID anlegen
	const neu: TeamsSettings = { aktiv: false, appId: randomUUID(), version: 1 };
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
