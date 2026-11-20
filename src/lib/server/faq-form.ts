/** Formularfelder einer FAQ lesen (Anlegen und Bearbeiten). */
import type { FaqInput } from './faqs.ts';

export function readFaqForm(form: FormData): FaqInput {
	return {
		unitId: String(form.get('einheit') ?? ''),
		question: String(form.get('frage') ?? '').slice(0, 400),
		answerHtml: String(form.get('antwort') ?? '').slice(0, 200_000),
		attachmentIds: form.getAll('anhaenge').map(String).slice(0, 50)
	};
}
