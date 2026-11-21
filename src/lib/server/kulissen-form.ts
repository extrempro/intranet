/** Formular „Hinter den Kulissen“ einlesen. */
import { beschreibungenAusForm } from './files/beschreibung.ts';
import type { PostInput } from './kulissen.ts';

export function readPostForm(f: FormData): PostInput {
	return {
		unitId: String(f.get('absender') ?? ''),
		title: String(f.get('titel') ?? '').slice(0, 300),
		bodyHtml: String(f.get('text') ?? '').slice(0, 200_000),
		tenantIds: f.getAll('mandanten').map(String).slice(0, 50),
		attachmentIds: f.getAll('anhaenge').map(String).slice(0, 50),
		consent: f.get('einwilligung') === 'on',
		descriptions: beschreibungenAusForm(f)
	};
}
