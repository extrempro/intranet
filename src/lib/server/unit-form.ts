import type { UnitType } from '../roles.ts';
import type { UnitInput } from './units.ts';

/** Formular „Einheit“ einlesen; Prüfungen macht units.ts. */
export function readUnitForm(form: FormData): UnitInput {
	const urgent = String(form.get('dringend') ?? 'standard');
	const events = String(form.get('termine') ?? 'standard');
	return {
		tenantId: String(form.get('mandant') ?? ''),
		type: String(form.get('typ') ?? '') as UnitType,
		name: String(form.get('name') ?? '').slice(0, 200),
		title: String(form.get('titel') ?? '') || null,
		isCentral: form.get('zentral') === 'on',
		hidden: form.get('ausgeblendet') === 'on',
		mayPostUrgent: urgent === 'ja' ? true : urgent === 'nein' ? false : null,
		mayCreateEvents: events === 'ja' ? true : events === 'nein' ? false : null,
		isKbb: form.get('kbb') === 'on'
	};
}
