/** Formular „Termin“ einlesen (Anlegen und Bearbeiten). */
import type { SaveEventInput } from './calendar.ts';

export function readEventForm(f: FormData): SaveEventInput {
	const s = (k: string, max: number) => String(f.get(k) ?? '').slice(0, max);
	const allDay = f.get('ganztaegig') === 'on';
	return {
		unitId: s('absender', 40),
		title: s('titel', 200),
		date: s('datum', 10),
		allDay,
		startTime: allDay ? '' : s('von', 5),
		endTime: allDay ? '' : s('bis', 5),
		place: s('ort', 300),
		description: s('beschreibung', 5000),
		allTenants: f.get('zielgruppe') !== 'auswahl',
		tenantIds: f.getAll('mandanten').map(String).slice(0, 50)
	};
}
