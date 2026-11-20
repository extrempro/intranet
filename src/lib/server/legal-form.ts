/** Formularfelder einer Vereinbarung lesen (Anlegen und Bearbeiten). */
import type { AgreementInput } from '../legal.ts';

export function readAgreementForm(f: FormData) {
	const s = (k: string, max: number) => String(f.get(k) ?? '').slice(0, max);
	const input: AgreementInput = {
		kind: s('art', 20),
		title: s('titel', 400),
		description: s('beschreibung', 2000),
		versionDate: s('stand', 10),
		validFrom: s('gilt_ab', 10)
	};
	return {
		input,
		tenantId: s('mandant', 40),
		attachmentIds: f.getAll('anhaenge').map(String).slice(0, 50),
		announce: f.get('bekanntgeben') === 'on'
	};
}
