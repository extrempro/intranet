/** Erneute Anmeldung vor kritischen Verwaltungsaktionen: Bausteine für Server und Browser */

/** BroadcastChannel: das Fenster der Microsoft-Anmeldung meldet die Bestätigung */
export const BESTAETIGUNG_KANAL = 'intranet-bestaetigung';

export type BestaetigungsWege =
	| { art: 'entra'; teams: boolean }
	| { art: 'lokal'; totp: boolean; passkey: boolean; teams: false };

/** Uhrzeit, bis zu der die Bestätigung gilt, z. B. „14:32“ */
export function bisUhrzeit(iso: string): string {
	return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
