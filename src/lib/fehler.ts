/** Überschrift der Fehlerseiten in einfacher Sprache */
export function fehlerTitel(status: number): string {
	if (status === 401) return 'Bitte melde dich an';
	if (status === 403) return 'Dafür fehlt dir das Recht';
	if (status === 404) return 'Seite nicht gefunden';
	if (status === 429) return 'Zu viele Anfragen';
	if (status >= 500) return 'Da ist etwas schiefgegangen';
	return 'Das hat nicht geklappt';
}

/** Standardtexte von SvelteKit (englisch) nicht anzeigen, ebenso eine Wiederholung des Titels */
const STANDARD = new Set([
	'Not Found',
	'Internal Error',
	'Forbidden',
	'Unauthorized',
	'Bad Request'
]);

export function fehlerText(message: string | undefined, titel: string): string | null {
	const m = message?.trim();
	if (!m || STANDARD.has(m) || m.replace(/\.$/, '') === titel) return null;
	return m;
}
