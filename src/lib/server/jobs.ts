/**
 * Zustand der Hintergrundaufgaben im Anwendungsprozess (Aufräumen,
 * Benachrichtigungen) für Verwaltung → System. Nur im Speicher: nach einem
 * Neustart erscheint „noch nicht gelaufen“ bis zum ersten Lauf.
 */
export interface JobState {
	at: Date;
	ok: boolean;
	fehler?: string;
	dauerMs: number;
}

const states = new Map<string, JobState>();

export async function track<T>(name: string, fn: () => Promise<T>): Promise<T> {
	const start = Date.now();
	try {
		const result = await fn();
		states.set(name, { at: new Date(), ok: true, dauerMs: Date.now() - start });
		return result;
	} catch (err) {
		// Nur die Meldung, keine Inhalte oder Stacktraces in die Oberfläche
		const fehler = err instanceof Error ? err.message.slice(0, 200) : 'Unbekannter Fehler';
		states.set(name, { at: new Date(), ok: false, fehler, dauerMs: Date.now() - start });
		throw err;
	}
}

export function jobState(name: string): JobState | null {
	return states.get(name) ?? null;
}
