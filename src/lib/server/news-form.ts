import { berlinToDate, endOfBerlinDay } from '../news.ts';
import type { SaveInput } from './news.ts';
import { beschreibungenAusForm } from './files/beschreibung.ts';

/** Rohwerte zum erneuten Anzeigen nach Fehlern. */
export interface NewsFormValues {
	unitId: string;
	title: string;
	bodyHtml: string;
	publishAt: string;
	expiresAt: string;
	pin: boolean;
	pinnedUntil: string;
	urgent: boolean;
	urgentUntil: string;
	urgentText: string;
	allTenants: boolean;
	tenantIds: string[];
	/** Nur für das Team (Kap. 8.17): '' = alle */
	teamScope: '' | 'mitglieder' | 'stamm';
	replacePin: boolean;
	attachments: {
		id: string;
		name: string;
		size: number;
		kind: string;
		description?: string | null;
	}[];
	/** Umfrage als JSON; undefined = Feld fehlte (unverändert lassen) */
	umfrage?: string;
}

export function readNewsForm(form: FormData): { input: SaveInput; values: NewsFormValues } {
	const s = (k: string, max = 500) => String(form.get(k) ?? '').slice(0, max);
	const values: NewsFormValues = {
		unitId: s('absender', 40),
		title: s('titel', 300),
		bodyHtml: s('text', 200_000),
		publishAt: s('freigabe', 20),
		expiresAt: s('ablauf', 20),
		pin: form.get('anheften') === 'on',
		pinnedUntil: s('angeheftet_bis', 20),
		urgent: form.get('dringend') === 'on',
		urgentUntil: s('dringend_bis', 20),
		urgentText: s('bannertext', 400),
		allTenants: form.get('zielgruppe') !== 'auswahl',
		tenantIds: form.getAll('mandanten').map(String).slice(0, 50),
		teamScope:
			form.get('sicht') === 'team' ? (form.get('kreis') === 'stamm' ? 'stamm' : 'mitglieder') : '',
		replacePin: form.get('ersetzen') === 'on',
		attachments: [],
		umfrage: form.has('umfrage') ? s('umfrage', 100_000) : undefined
	};
	const input: SaveInput = {
		unitId: values.unitId,
		title: values.title,
		bodyHtml: values.bodyHtml,
		bodyText: '',
		publishAt: values.publishAt ? berlinToDate(values.publishAt) : new Date(),
		expiresAt: values.expiresAt ? endOfBerlinDay(values.expiresAt) : null,
		pinnedUntil: values.pin
			? values.pinnedUntil
				? endOfBerlinDay(values.pinnedUntil)
				: null
			: null,
		urgentUntil: values.urgent
			? values.urgentUntil
				? berlinToDate(values.urgentUntil)
				: null
			: null,
		urgentText: values.urgent ? values.urgentText : null,
		allTenants: values.allTenants,
		tenantIds: values.tenantIds,
		teamScope: values.teamScope || null,
		replacePin: values.replacePin,
		attachmentIds: form.getAll('anhaenge').map(String).slice(0, 20),
		descriptions: beschreibungenAusForm(form)
	};
	// Anheften ohne Datum: Pflichtfeld (Kap. 8.1) – als ungültiges Datum melden
	if (values.pin && !values.pinnedUntil) input.pinnedUntil = new Date(0);
	return { input, values };
}
